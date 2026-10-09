import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    addDays,
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import Routine from "../../src/models/Routine.js";
import RoutineLog from "../../src/models/RoutineLog.js";
import Habit from "../../src/models/Habit.js";
import DailyLog from "../../src/models/DailyLog.js";
import { settleEndedDays } from "../../src/utils/dailyPenaltyJob.js";
import { getWeekday } from "../../src/utils/dateRules.js";

// The account's run: a day adds to it when something was due and every routine and habit due was done.
// A day with nothing due neither adds to it nor ends it. Anything left undone ends it once the day closes.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("the account's run of days", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 40 * DAY);

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });

        return {
            client,
            user,
            routine: async (fields = {}) =>
                (await client.post("/routines", { title: "Routine", startTime: "00:00", isRecurring: true, recurringDays: EVERY_DAY, ...fields })).body,
            habit: async (fields = {}) =>
                (await client.post("/habits", { title: "Habit", difficulty: "easy", ...fields })).body.habit,
            complete: (routine) => client.post(`/routines/${routine._id}/complete`, {}),
            undo: (routine) => client.delete(`/routines/${routine._id}/complete`, {}),
            tick: (habit, quantity = 1) => client.put(`/habits/${habit._id}/log`, { quantity }),
            xp: async () => (await client.get("/gamification/stats")).body.totalXp,
            info: async () => (await client.get("/streaks/info")).body,
            summary: async () =>
                (await client.get("/streaks/logs?days=3")).body.logs.find((log) => log.date === today),
            // Days that were perfect, as the account holds them
            perfectOn: (...ago) =>
                DailyLog.create(ago.map((days) => ({ user: user._id, date: daysAgo(days), totalRoutines: 1, completedRoutines: 1, isPerfectDay: true }))),
            restOn: (...ago) =>
                DailyLog.create(ago.map((days) => ({ user: user._id, date: daysAgo(days), isRestDay: true }))),
        };
    };

    describe("a day with everything done", () => {
        it("needs the habits as well as the routines", async () => {
            const { routine, habit, complete, tick, xp, info, summary } = await setup();
            const item = await routine();
            const kept = await habit();

            await complete(item);
            assert.equal((await summary()).isPerfectDay, false);
            assert.equal(await xp(), 10);
            assert.equal((await info()).currentStreak, 0);

            await tick(kept);
            const day = await summary();
            assert.deepEqual(
                [day.totalRoutines, day.completedRoutines, day.totalHabits, day.completedHabits, day.isPerfectDay, day.isRestDay],
                [1, 1, 1, 1, true, false],
            );
            // 10 for the routine, 10 for the habit, 20 for the day
            assert.equal(await xp(), 40);
            const after = await info();
            assert.equal(after.currentStreak, 1);
            assert.equal(after.todayBonus, 20);
        });

        it("is reached by habits alone when no routine is due", async () => {
            const { habit, tick, xp, info } = await setup();
            const first = await habit();
            const second = await habit({ title: "Second" });

            await tick(first);
            assert.equal(await xp(), 10);
            await tick(second);
            assert.equal(await xp(), 40);
            assert.equal((await info()).currentStreak, 1);
        });

        it("stops being one when a habit is un-ticked, and the bonus goes back", async () => {
            const { routine, habit, complete, tick, xp, info, summary } = await setup();
            await complete(await routine());
            const kept = await habit();
            await tick(kept);
            assert.equal(await xp(), 40);

            await tick(kept, 0);
            assert.equal(await xp(), 10);
            assert.equal((await summary()).isPerfectDay, false);
            assert.equal((await info()).currentStreak, 0);

            // Ticking again pays the bonus once more, not twice
            await tick(kept);
            assert.equal(await xp(), 40);
        });

        it("does not count a habit that is not due today", async () => {
            const { routine, habit, complete, summary } = await setup();
            const otherDay = (getWeekday(today) + 3) % 7;
            await habit({ frequency: "weekly", targetDays: [otherDay] });

            await complete(await routine());
            const day = await summary();
            assert.equal(day.totalHabits, 0);
            assert.equal(day.isPerfectDay, true);
        });

        it("adds to the run that led up to it", async () => {
            const { routine, complete, info, perfectOn } = await setup();
            await perfectOn(3, 2, 1);

            await complete(await routine());
            const { currentStreak, bestStreak } = await info();
            assert.deepEqual([currentStreak, bestStreak], [4, 4]);
        });
    });

    describe("a day with nothing due", () => {
        it("neither adds to the run nor ends it", async () => {
            const { routine, complete, info, perfectOn, restOn } = await setup();
            // Three days with everything done, two days off, then today
            await perfectOn(5, 4, 3);
            await restOn(2, 1);

            assert.equal((await info()).currentStreak, 0); // not worked out until something moves

            await complete(await routine());
            assert.equal((await info()).currentStreak, 4);
        });

        it("is recorded as one when it closes, and costs nothing", async () => {
            const { client, user, info, perfectOn } = await setup();
            await perfectOn(3, 2);
            // A routine that falls on another day of the week only: yesterday asked for nothing
            const notYesterday = (getWeekday(daysAgo(1)) + 3) % 7;
            await Routine.create({ user: user._id, title: "Another day", startTime: "08:00", isRecurring: true, recurringDays: [notYesterday], createdAt: longAgo });
            await User.updateOne({ _id: user._id }, { xp: 300, penaltiesSettledThrough: daysAgo(2) });

            const before = await info(); // this request closes yesterday
            assert.equal((await User.findById(user._id)).xp, 300);

            const yesterday = await DailyLog.findOne({ user: user._id, date: daysAgo(1) });
            assert.deepEqual([yesterday.isRestDay, yesterday.isPerfectDay], [true, false]);
            // The run of two still stands behind the day off
            assert.equal(before.currentStreak, 2);

            const recap = (await client.get("/streaks/recap")).body.days.find((day) => day.date === daysAgo(1));
            assert.equal(recap.isRestDay, true);
            assert.equal(recap.streakEnded, 0);

            const looked = (await client.get(`/history/days/${daysAgo(1)}`)).body;
            assert.equal(looked.summary.isRestDay, true);
            assert.equal(looked.streakEnded, 0);
        });
    });

    describe("a day that closes with something left undone", () => {
        it("ends the run, whether what was left was a routine or a habit", async () => {
            for (const kind of ["routine", "habit"]) {
                const { client, user, info, perfectOn } = await setup();
                await perfectOn(4, 3, 2);

                // Yesterday: a routine that was done, and one more thing that was not
                const done = await Routine.create({ user: user._id, title: "Done", startTime: "08:00", isRecurring: true, recurringDays: EVERY_DAY, createdAt: longAgo });
                await RoutineLog.create({ routine: done._id, user: user._id, date: daysAgo(1), completedAt: "08:05", xpEarned: 10 });
                if (kind === "routine") {
                    await Routine.create({ user: user._id, title: "Left", startTime: "09:00", isRecurring: true, recurringDays: EVERY_DAY, createdAt: longAgo });
                } else {
                    await Habit.create({ user: user._id, title: "Left", createdAt: longAgo });
                }
                await User.updateOne({ _id: user._id }, { xp: 300, penaltiesSettledThrough: daysAgo(2) });

                assert.equal((await info()).currentStreak, 0, kind);

                const yesterday = await DailyLog.findOne({ user: user._id, date: daysAgo(1) });
                assert.deepEqual([yesterday.isPerfectDay, yesterday.isRestDay, yesterday.streakDay], [false, false, 0], kind);

                const recap = (await client.get("/streaks/recap")).body.days.find((day) => day.date === daysAgo(1));
                assert.equal(recap.streakEnded, 3, kind);
            }
        });

        it("does not end it while the day is still open", async () => {
            const { routine, habit, info, perfectOn, complete, undo } = await setup();
            await perfectOn(2, 1);
            const item = await routine();
            await habit();

            await complete(item);
            assert.equal((await info()).currentStreak, 2);
            await undo(item);
            assert.equal((await info()).currentStreak, 2);
        });
    });

    it("is worked out the same way by the settlement on a later day", async () => {
        const { user, routine, complete, habit, tick } = await setup();
        await complete(await routine());
        await tick(await habit());

        // Tomorrow passes with nothing done
        await settleEndedDays(await User.findById(user._id), new Date(Date.now() + 2 * DAY));

        const account = await User.findById(user._id);
        assert.equal(account.currentStreak, 0);
        assert.equal(account.bestStreak, 1);
        const tomorrow = await DailyLog.findOne({ user: user._id, date: addDays(today, 1) });
        assert.deepEqual([tomorrow.isPerfectDay, tomorrow.isRestDay, tomorrow.totalRoutines, tomorrow.totalHabits], [false, false, 1, 1]);
    });
});
