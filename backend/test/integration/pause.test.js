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
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import DailyLog from "../../src/models/DailyLog.js";
import XPLog from "../../src/models/XPLog.js";
import { settleEndedDays } from "../../src/utils/dailyPenaltyJob.js";

// Pausing a routine or habit for a number of days: off the day's list, not charged, no run broken.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("pausing", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 40 * DAY);

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });
        await User.updateOne({ _id: user._id }, { xp: 1000 });

        return {
            client,
            user,
            routine: async (fields = {}) => {
                const made = (
                    await client.post("/routines", { title: "Study", startTime: "16:00", endTime: "20:00", isRecurring: true, recurringDays: EVERY_DAY, ...fields })
                ).body;
                // As if it had been in the plan for a while, so that today counts it
                await Routine.updateOne({ _id: made._id }, { createdAt: longAgo });
                return made;
            },
            habit: async (fields = {}) => {
                const made = (await client.post("/habits", { title: "Read", difficulty: "easy", ...fields })).body.habit;
                await Habit.updateOne({ _id: made._id }, { createdAt: longAgo });
                return made;
            },
            todays: async (date) =>
                (await client.get(date ? `/routines?date=${date}` : "/routines")).body.routines.map((entry) => entry._id),
            settle: async (days) =>
                settleEndedDays(await User.findById(user._id), new Date(Date.now() + days * DAY)),
            lostOn: async (day) =>
                (await XPLog.find({ user: user._id, "metadata.date": day, reason: /_missed$/ })).reduce(
                    (sum, entry) => sum + entry.amount,
                    0,
                ),
        };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        const id = "a".repeat(24);

        assert.equal((await stranger.post(`/routines/${id}/pause`, { days: 3 })).status, 401);
        assert.equal((await stranger.delete(`/habits/${id}/pause`)).status, 401);
    });

    it("takes a routine off its days for as long as asked, and charges nothing for them", async () => {
        const { client, routine, todays, settle, lostOn } = await setup();
        const item = await routine();

        const paused = await client.post(`/routines/${item._id}/pause`, { days: 3 });
        assert.equal(paused.status, 200);
        assert.deepEqual(paused.body.pauses, [{ from: today, until: addDays(today, 2) }]);

        // Off today's list and tomorrow's, back on the day after the pause, and still in the plan throughout
        assert.equal((await todays()).includes(item._id), false);
        assert.equal((await todays(addDays(today, 1))).includes(item._id), false);
        assert.equal((await todays(addDays(today, 3))).includes(item._id), true);
        const plan = (await client.get("/routines/all")).body.routines;
        assert.equal(plan.some((entry) => entry._id === item._id), true);

        const tick = await client.post(`/routines/${item._id}/complete`, {});
        assert.equal(tick.status, 400);
        assert.match(tick.body.message, /paused/);

        await settle(5);
        assert.equal(await lostOn(today), 0);
        assert.equal(await lostOn(addDays(today, 1)), 0);
        assert.equal(await lostOn(addDays(today, 2)), 0);
        assert.equal(await lostOn(addDays(today, 3)), -5);
        assert.equal(await lostOn(addDays(today, 4)), -5);
    });

    it("can start on a later day, leaving the days before it as they were", async () => {
        const { client, routine, todays } = await setup();
        const item = await routine();

        const paused = await client.post(`/routines/${item._id}/pause`, { from: addDays(today, 2), days: 8 });
        assert.deepEqual(paused.body.pauses, [{ from: addDays(today, 2), until: addDays(today, 9) }]);
        assert.equal((await todays()).includes(item._id), true);
        assert.equal((await todays(addDays(today, 2))).includes(item._id), false);
        assert.equal((await todays(addDays(today, 9))).includes(item._id), false);
        assert.equal((await todays(addDays(today, 10))).includes(item._id), true);
    });

    it("refuses a pause that starts in the past, lasts no days, or is for a one-off task", async () => {
        const { client, routine } = await setup();
        const item = await routine();
        const task = await routine({ isRecurring: false, recurringDays: [], date: addDays(today, 1) });

        assert.equal((await client.post(`/routines/${item._id}/pause`, { from: daysAgo(1), days: 3 })).status, 400);
        assert.equal((await client.post(`/routines/${item._id}/pause`, { days: 0 })).status, 400);
        assert.equal((await client.post(`/routines/${item._id}/pause`, { days: 400 })).status, 400);
        assert.equal((await client.post(`/routines/${item._id}/pause`, {})).status, 400);
        assert.equal((await client.post(`/routines/${task._id}/pause`, { days: 3 })).status, 400);
        assert.equal((await Routine.findById(item._id)).pauses.length, 0);
    });

    it("ends early when resumed: due again from today, with the days already off kept", async () => {
        const { client, routine, todays } = await setup();
        const item = await routine();
        // Paused since three days ago, for a week
        await Routine.updateOne({ _id: item._id }, { pauses: [{ from: daysAgo(3), until: addDays(today, 3) }] });
        assert.equal((await todays()).includes(item._id), false);

        const resumed = await client.delete(`/routines/${item._id}/pause`);
        assert.equal(resumed.status, 200);
        assert.deepEqual(resumed.body.pauses, [{ from: daysAgo(3), until: daysAgo(1) }]);
        assert.equal((await todays()).includes(item._id), true);
    });

    it("drops a pause that had not started yet when resumed, and replaces what is left of one when set again", async () => {
        const { client, routine } = await setup();
        const item = await routine();
        await Routine.updateOne({ _id: item._id }, { pauses: [{ from: daysAgo(2), until: addDays(today, 1) }] });

        const again = await client.post(`/routines/${item._id}/pause`, { from: addDays(today, 5), days: 2 });
        assert.deepEqual(again.body.pauses, [
            { from: daysAgo(2), until: daysAgo(1) },
            { from: addDays(today, 5), until: addDays(today, 6) },
        ]);

        const resumed = await client.delete(`/routines/${item._id}/pause`);
        assert.deepEqual(resumed.body.pauses, [{ from: daysAgo(2), until: daysAgo(1) }]);
    });

    it("keeps a habit's streak through the days it is paused", async () => {
        const { client, user, habit } = await setup();
        const item = await habit();
        await HabitLog.create([
            { habit: item._id, user: user._id, date: daysAgo(5), completed: true },
            { habit: item._id, user: user._id, date: daysAgo(4), completed: true },
            { habit: item._id, user: user._id, date: daysAgo(3), completed: true },
        ]);
        await Habit.updateOne({ _id: item._id }, { pauses: [{ from: daysAgo(2), until: daysAgo(1) }] });

        const logged = (await client.put(`/habits/${item._id}/log`, { quantity: 1 })).body.habit;
        assert.equal(logged.currentStreak, 4);
        assert.equal(logged.bestStreak, 4);

        const history = (await client.get(`/habits/${item._id}/history`)).body;
        assert.equal(history.run.current, 4);
    });

    it("is not due on a day it is paused, and a day with nothing else due is a rest day", async () => {
        const { client, user, habit, settle, lostOn } = await setup();
        const item = await habit();

        await client.post(`/habits/${item._id}/pause`, { days: 2 });
        const listed = (await client.get("/habits")).body.habits.find((entry) => entry._id === item._id);
        assert.equal(listed.dueToday, false);

        await settle(2);
        assert.equal(await lostOn(today), 0);
        const summary = await DailyLog.findOne({ user: user._id, date: today });
        assert.equal(summary.isRestDay, true);
        assert.equal(summary.totalHabits, 0);
    });

    it("can't pause another account's routine or habit", async () => {
        const owner = await setup();
        const other = await setup();
        const routine = await owner.routine();
        const habit = await owner.habit();

        assert.equal((await other.client.post(`/routines/${routine._id}/pause`, { days: 2 })).status, 404);
        assert.equal((await other.client.post(`/habits/${habit._id}/pause`, { days: 2 })).status, 404);
        assert.equal((await other.client.delete(`/habits/${habit._id}/pause`)).status, 404);
    });
});
