import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import {
    addDays,
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
    uniqueEmail,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import Routine from "../../src/models/Routine.js";
import RoutineLog from "../../src/models/RoutineLog.js";
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import DailyLog from "../../src/models/DailyLog.js";
import XPLog from "../../src/models/XPLog.js";
import {
    settleEndedDays,
    sweepEndedDays,
} from "../../src/utils/dailyPenaltyJob.js";
import { getWeekday } from "../../src/utils/dateRules.js";

// End-of-day settlement: missed-task penalties, charged once per day, at each user's own midnight.
// Days are made to pass by handing the settlement a later "now".

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("end-of-day settlement", { skip: skipWithoutDatabase }, () => {
    const realNow = new Date();
    const day0 = todayIn(TZ);
    const daysLater = (days) => new Date(realNow.getTime() + days * DAY);

    before(startApp);
    after(stopApp);

    const makeUser = (fields = {}) =>
        User.create({
            name: "Settlement Test",
            email: uniqueEmail("settle"),
            password: "never-used-to-log-in",
            timezone: TZ,
            xp: 1000,
            penaltiesSettledThrough: addDays(day0, -1),
            ...fields,
        });
    const reload = (user) => User.findById(user._id);
    const settle = async (user, days) => settleEndedDays(await reload(user), daysLater(days));
    const xpOf = async (user) => (await reload(user)).xp;
    const lostOn = async (user, day) =>
        (await XPLog.find({ user: user._id, "metadata.date": day, reason: /_missed$/ }))
            .reduce((sum, log) => sum + log.amount, 0);
    const dailyRoutine = (user, fields = {}) =>
        Routine.create({ user: user._id, title: "Daily", startTime: "08:00", endTime: "09:00", isRecurring: true, recurringDays: EVERY_DAY, xpReward: 10, ...fields });

    describe("over several simulated days", () => {
        let user;
        let dailyHabit;
        const weekday0 = getWeekday(day0);
        const otherWeekday = (weekday0 + 3) % 7;
        const tomorrowWeekday = (weekday0 + 1) % 7;

        // What the rules say a day should cost, written out independently of the implementation
        const expectedLoss = (day) => {
            const offset = Math.round((Date.parse(day) - Date.parse(day0)) / DAY);
            const weekday = getWeekday(day);
            let loss = 3; // the daily habit, never done
            if (offset === 0) loss += 5; // the one-time routine planned for day 0
            if (offset > 0) loss += 5; // the daily routine, done on day 0 only
            if (offset >= 1) loss += 10; // the routine that only exists from day 1
            if (weekday === otherWeekday) loss += 5; // the single-weekday routine, on its day
            if (weekday === tomorrowWeekday) loss += 5; // the weekly habit, on its day
            return loss;
        };

        before(async () => {
            user = await makeUser({ currentStreak: 5 });

            const done = await dailyRoutine(user, { title: "Daily, done on day 0" });
            await RoutineLog.create({ routine: done._id, user: user._id, date: day0, completedAt: "08:10", wasOnTime: true, xpEarned: 10 });
            await dailyRoutine(user, { title: "One-time, missed", isRecurring: false, recurringDays: [], date: day0 });
            await dailyRoutine(user, { title: "One weekday only", recurringDays: [otherWeekday] });
            await dailyRoutine(user, { title: "Deleted", xpReward: 40, isActive: false });
            await dailyRoutine(user, { title: "Created tomorrow", xpReward: 20, createdAt: daysLater(1) });

            dailyHabit = await Habit.create({ user: user._id, title: "Daily", difficulty: "easy", currentStreak: 2 });
            await Habit.create({ user: user._id, title: "Weekly", difficulty: "medium", frequency: "weekly", targetDays: [tomorrowWeekday] });
            await Habit.create({ user: user._id, title: "Deleted", difficulty: "hard", isActive: false });
            await HabitLog.create([
                { habit: dailyHabit._id, user: user._id, date: addDays(day0, -2) },
                { habit: dailyHabit._id, user: user._id, date: addDays(day0, -1) },
            ]);
        });

        it("charges nothing while the day is still running", async () => {
            await settle(user, 0);
            assert.equal(await xpOf(user), 1000);
        });

        it("charges exactly the missed items when the day ends", async () => {
            await settle(user, 1);
            assert.equal(expectedLoss(day0), 8);
            assert.equal(await xpOf(user), 992);

            // Not the completed, deleted, off-day or not-yet-created ones
            const entries = (await XPLog.find({ user: user._id, "metadata.date": day0 }))
                .map((log) => `${log.reason} ${log.amount}`)
                .sort();
            assert.deepEqual(entries, ["habit_missed -3", "routine_missed -5"]);
        });

        it("completes the day's summary and resets broken streaks", async () => {
            const summary = await DailyLog.findOne({ user: user._id, date: day0 });
            assert.equal(summary.totalRoutines, 2);
            assert.equal(summary.completedRoutines, 1);
            assert.equal(summary.totalHabits, 1);
            assert.equal(summary.completedHabits, 0);
            assert.equal(summary.xpEarned, -8);

            assert.equal((await Habit.findById(dailyHabit._id)).currentStreak, 0);
            assert.equal((await reload(user)).currentStreak, 0);
        });

        it("changes nothing when the same day is settled again", async () => {
            await settle(user, 1);
            await settle(user, 1);
            assert.equal(await xpOf(user), 992);
        });

        it("charges a day exactly once when four processes close it together", async () => {
            const child = fileURLToPath(new URL("../helpers/settleInChild.js", import.meta.url));
            const moment = daysLater(2).toISOString();
            const exits = await Promise.all(
                [1, 2, 3, 4].map(async () => {
                    const [code] = await once(spawn(process.execPath, [child, user._id.toString(), moment], { stdio: "ignore" }), "exit");
                    return code;
                }),
            );
            assert.deepEqual(exits, [0, 0, 0, 0]);

            const day1 = addDays(day0, 1);
            assert.equal(await lostOn(user, day1), -expectedLoss(day1));
            assert.equal(await xpOf(user), 992 - expectedLoss(day1));
        });

        it("charges only the most recent 7 days after a long absence", async () => {
            const before = await xpOf(user);
            await settle(user, 20); // days 2 to 19 have ended

            const charged = [];
            for (let offset = 2; offset <= 19; offset++) {
                if ((await lostOn(user, addDays(day0, offset))) !== 0) charged.push(offset);
            }
            assert.deepEqual(charged, [13, 14, 15, 16, 17, 18, 19]);

            const weekLoss = charged.reduce((sum, offset) => sum + expectedLoss(addDays(day0, offset)), 0);
            assert.equal(await xpOf(user), before - weekLoss);
        });

        it("never takes XP below zero, and logs what was really lost", async () => {
            await User.updateOne({ _id: user._id }, { xp: 4 });
            await settle(user, 21);

            const day20 = addDays(day0, 20);
            assert.equal(await xpOf(user), 0);
            assert.equal(await lostOn(user, day20), -4);
            assert.equal((await DailyLog.findOne({ user: user._id, date: day20 })).xpEarned, -4);
        });
    });

    describe("an account from before this job existed (no marker)", () => {
        it("is not charged for the past, then charged normally", async () => {
            const legacy = await makeUser({ penaltiesSettledThrough: "", createdAt: daysLater(-30) });
            await dailyRoutine(legacy, { createdAt: daysLater(-30) });

            await settle(legacy, 0);
            assert.equal(await xpOf(legacy), 1000);
            assert.equal((await reload(legacy)).penaltiesSettledThrough, addDays(day0, -1));

            await settle(legacy, 1);
            assert.equal(await xpOf(legacy), 995);
        });
    });

    describe("the background sweep", () => {
        it("closes the days an account is behind and leaves others alone", async () => {
            const behind = await makeUser({ penaltiesSettledThrough: addDays(day0, -3), createdAt: daysLater(-10) });
            await dailyRoutine(behind, { createdAt: daysLater(-10) });
            const upToDate = await makeUser();

            await sweepEndedDays();

            assert.equal(await xpOf(behind), 990); // two days at 5 XP each
            assert.equal((await reload(behind)).penaltiesSettledThrough, addDays(day0, -1));
            assert.equal(await xpOf(upToDate), 1000);
        });
    });

    describe("on the user's next request", () => {
        it("settles first, once, so every answer already shows it", async () => {
            const client = createClient({ timezone: TZ });
            const { email } = await client.register();
            assert.equal((await client.get("/auth/me")).body.user.penaltiesSettledThrough, addDays(day0, -1));

            // Put the account two days behind, with a routine that already existed then
            const user = await User.findOne({ email });
            await dailyRoutine(user, { createdAt: daysLater(-5) });
            await User.updateOne({ _id: user._id }, { xp: 500, penaltiesSettledThrough: addDays(day0, -3) });

            const burst = await Promise.all([
                client.get("/gamification/stats"),
                client.get("/habits"),
                client.get(`/routines?date=${day0}`),
                client.get("/streaks/info"),
                client.get("/gamification/stats"),
            ]);
            assert.ok(burst.every((response) => response.status === 200));
            assert.equal(burst[0].body.totalXp, 490);
            assert.equal(burst[4].body.totalXp, 490);

            const missedDays = (await client.get("/gamification/xp-history")).body.history
                .filter((entry) => entry.reason === "routine_missed")
                .map((entry) => entry.metadata.date)
                .sort();
            assert.deepEqual(missedDays, [addDays(day0, -2), addDays(day0, -1)]);

            assert.equal((await client.get("/gamification/stats")).body.totalXp, 490);
            assert.equal((await client.get("/auth/me")).body.user.penaltiesSettledThrough, addDays(day0, -1));
        });
    });
});
