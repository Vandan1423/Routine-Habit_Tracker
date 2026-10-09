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

// What the Today screen is told about the days that have ended: what was left undone on each, what that cost,
// and the streak it ended; and, for the day still running, the bonus for having every routine done.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("the recap of ended days", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 10 * DAY);

    before(startApp);
    after(stopApp);

    // A signed-in account, and the same account as the database holds it
    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });

        return {
            client,
            user,
            routine: (fields = {}) =>
                Routine.create({ user: user._id, title: "Routine", startTime: "08:00", endTime: "09:00", isRecurring: true, recurringDays: EVERY_DAY, xpReward: 10, createdAt: longAgo, ...fields }),
            habit: (fields = {}) =>
                Habit.create({ user: user._id, title: "Habit", difficulty: "medium", createdAt: longAgo, ...fields }),
            done: (routine, date) =>
                RoutineLog.create({ routine: routine._id, user: user._id, date, completedAt: "08:10", wasOnTime: true, xpEarned: routine.xpReward }),
            // Puts the account this many days behind, so its next request closes them
            fallBehind: (days, xp = 500) =>
                User.updateOne({ _id: user._id }, { xp, penaltiesSettledThrough: daysAgo(days + 1) }),
            recap: async () => (await client.get("/streaks/recap")).body,
        };
    };

    it("is empty for an account with no day behind it", async () => {
        const { client } = await setup();

        const response = await client.get("/streaks/recap");
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { today, days: [] });
    });

    it("names what was left undone on each ended day and what it cost", async () => {
        const { user, routine, habit, done, fallBehind, recap } = await setup();

        const run = await routine({ title: "Morning run" });
        const read = await routine({ title: "Read", xpReward: 20 });
        const journal = await habit({ title: "Journal" });
        // The run was done the day before yesterday; nothing was done yesterday
        await done(run, daysAgo(2));
        await fallBehind(2);

        const { days } = await recap();
        assert.deepEqual(days.map((day) => day.date), [daysAgo(1), daysAgo(2)]);

        const [yesterday, dayBefore] = days;
        const named = (day) => day.missed.map((item) => `${item.kind} ${item.title} ${item.xpLost}`).sort();

        assert.deepEqual(named(yesterday), ["habit Journal 5", "routine Morning run 5", "routine Read 10"]);
        assert.equal(yesterday.xpLost, 20);
        assert.equal(yesterday.totalRoutines, 2);
        assert.equal(yesterday.completedRoutines, 0);
        assert.equal(yesterday.totalHabits, 1);
        assert.equal(yesterday.completedHabits, 0);
        assert.equal(yesterday.isPerfectDay, false);
        assert.equal(yesterday.xpEarned, -20);

        assert.deepEqual(named(dayBefore), ["habit Journal 5", "routine Read 10"]);
        assert.equal(dayBefore.xpLost, 15);
        assert.equal(dayBefore.completedRoutines, 1);

        // Each entry points at the item it is about
        const ids = Object.fromEntries(yesterday.missed.map((item) => [item.title, item.id]));
        assert.deepEqual(ids, { "Morning run": run._id.toString(), Read: read._id.toString(), Journal: journal._id.toString() });

        // What the recap adds up to is what the account lost
        assert.equal((await User.findById(user._id)).xp, 500 - 20 - 15);
    });

    it("reports a day with every routine done as clean", async () => {
        const { routine, done, fallBehind, recap } = await setup();

        const run = await routine();
        await done(run, daysAgo(1));
        await fallBehind(1);

        const { days } = await recap();
        assert.equal(days.length, 1);
        assert.equal(days[0].isPerfectDay, true);
        assert.deepEqual(days[0].missed, []);
        assert.equal(days[0].xpLost, 0);
        assert.equal(days[0].streakEnded, 0);
    });

    it("says how long a streak was on the day that ended it, and only on that day", async () => {
        const { user, routine, fallBehind, recap } = await setup();

        await routine();
        // Three days with every routine done, then two with none
        await DailyLog.create(
            [5, 4, 3].map((days) => ({ user: user._id, date: daysAgo(days), totalRoutines: 1, completedRoutines: 1, isPerfectDay: true })),
        );
        await fallBehind(2);

        const { days } = await recap();
        const ended = Object.fromEntries(days.map((day) => [day.date, day.streakEnded]));

        assert.equal(ended[daysAgo(2)], 3);
        assert.equal(ended[daysAgo(1)], 0);
        assert.equal(ended[daysAgo(3)], 0);
    });

    it("still names an item that has been deleted since", async () => {
        const { routine, fallBehind, recap } = await setup();

        const gone = await routine({ title: "Stretch" });
        await fallBehind(1);
        await recap();
        await Routine.updateOne({ _id: gone._id }, { isActive: false });

        const { days } = await recap();
        assert.deepEqual(days[0].missed.map((item) => item.title), ["Stretch"]);
    });

    it("lists only what was really taken when there was little XP to lose", async () => {
        const { routine, fallBehind, recap } = await setup();

        await routine({ title: "First" });
        await routine({ title: "Second" });
        await fallBehind(1, 3);

        const { days } = await recap();
        assert.equal(days[0].totalRoutines, 2);
        assert.equal(days[0].completedRoutines, 0);
        assert.equal(days[0].xpLost, 3);
        assert.deepEqual(days[0].missed.map((item) => item.xpLost), [3]);
    });

    it("looks back a week and no further", async () => {
        const { user, recap } = await setup();

        await DailyLog.create(
            [1, 7, 8, 30].map((days) => ({ user: user._id, date: daysAgo(days), totalRoutines: 1, completedRoutines: 1, isPerfectDay: true })),
        );

        const { days } = await recap();
        assert.deepEqual(days.map((day) => day.date), [daysAgo(1), daysAgo(7)]);
    });

    it("shows each account its own days only, and nothing to a visitor", async () => {
        const mine = await setup();
        const theirs = await setup();

        await mine.routine({ title: "Mine" });
        await mine.fallBehind(1);

        assert.equal((await mine.recap()).days.length, 1);
        assert.deepEqual((await theirs.recap()).days, []);
        assert.equal((await createClient({ timezone: TZ }).get("/streaks/recap")).status, 401);
    });

    describe("the bonus for a day with every routine done", () => {
        it("is reported for today, and goes when the day stops being complete", async () => {
            const { client } = await setup();
            const info = async () => (await client.get("/streaks/info")).body;

            const routine = (await client.post("/routines", { title: "Only one", startTime: "00:00", isRecurring: false, recurringDays: [], date: today })).body;
            assert.equal((await info()).today, today);
            assert.equal((await info()).todayBonus, 0);

            await client.post(`/routines/${routine._id}/complete`, { date: today });
            assert.equal((await info()).todayBonus, 20);

            await client.delete(`/routines/${routine._id}/complete`, { date: today });
            assert.equal((await info()).todayBonus, 0);

            await client.post(`/routines/${routine._id}/complete`, { date: today });
            assert.equal((await info()).todayBonus, 20);
        });
    });
});
