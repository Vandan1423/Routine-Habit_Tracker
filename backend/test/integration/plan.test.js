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
import HabitLog from "../../src/models/HabitLog.js";
import XPLog from "../../src/models/XPLog.js";

// What the Plan screen needs: every routine whatever day it falls on, habits in an order of the user's
// choosing, a deleted item brought back, and one item's past days.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("the plan", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
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
                (await client.post("/routines", { title: "Routine", startTime: "08:00", isRecurring: true, recurringDays: EVERY_DAY, ...fields })).body,
            habit: async (fields = {}) =>
                (await client.post("/habits", { title: "Habit", ...fields })).body.habit,
            habitTitles: async () =>
                (await client.get("/habits")).body.habits.map((habit) => habit.title),
        };
    };

    describe("every routine", () => {
        it("lists the repeating ones whatever day they fall on, and one-off tasks to come or of the last six days", async () => {
            const { client, routine } = await setup();
            const notToday = (weekdayOf(today) + 3) % 7;

            await routine({ title: "Daily", startTime: "09:00" });
            await routine({ title: "Another day", startTime: "07:00", recurringDays: [notToday] });
            await routine({ title: "Today, once", isRecurring: false, recurringDays: [], date: today });
            await routine({ title: "Next week, once", isRecurring: false, recurringDays: [], date: addDays(today, 7) });
            await routine({ title: "Last week, once", isRecurring: false, recurringDays: [], date: daysAgo(7) });
            await routine({ title: "Earlier this week, once", isRecurring: false, recurringDays: [], date: daysAgo(6) });

            const response = await client.get("/routines/all");
            assert.equal(response.status, 200);
            assert.equal(response.body.today, today);
            assert.deepEqual(
                response.body.routines.map((item) => item.title).sort(),
                ["Another day", "Daily", "Earlier this week, once", "Next week, once", "Today, once"],
            );

            // The day's own list still holds only what falls on that day
            const todays = (await client.get("/routines")).body.routines.map((item) => item.title).sort();
            assert.deepEqual(todays, ["Daily", "Today, once"]);
        });

        it("leaves out deleted routines and other people's", async () => {
            const { client, routine } = await setup();
            const other = await setup();

            const kept = await routine({ title: "Kept" });
            const gone = await routine({ title: "Gone" });
            await other.routine({ title: "Someone else's" });
            await client.delete(`/routines/${gone._id}`);

            const { routines } = (await client.get("/routines/all")).body;
            assert.deepEqual(routines.map((item) => item._id), [kept._id]);
        });

        it("needs a session", async () => {
            assert.equal((await createClient().get("/routines/all")).status, 401);
        });
    });

    describe("bringing back what was deleted", () => {
        it("puts a routine back in the plan and in its day", async () => {
            const { client, routine } = await setup();
            const item = await routine();

            await client.delete(`/routines/${item._id}`);
            assert.equal((await client.get("/routines")).body.routines.length, 0);

            const restored = await client.post(`/routines/${item._id}/restore`);
            assert.equal(restored.status, 200);
            assert.equal(restored.body._id, item._id);
            assert.equal(restored.body.isActive, true);
            assert.equal((await client.get("/routines")).body.routines.length, 1);
        });

        it("puts a habit back with what it had", async () => {
            const { client, habit } = await setup();
            const item = await habit({ difficulty: "hard", timeOfDay: "evening" });
            await client.put(`/habits/${item._id}/log`, { quantity: 1 });

            await client.delete(`/habits/${item._id}`);
            assert.equal((await client.get("/habits")).body.habits.length, 0);

            const restored = await client.post(`/habits/${item._id}/restore`);
            assert.equal(restored.status, 200);
            assert.equal(restored.body.habit.isActive, true);

            const [listed] = (await client.get("/habits")).body.habits;
            assert.equal(listed.timeOfDay, "evening");
            assert.equal(listed.todayLog.completed, true);
            assert.equal(listed.currentStreak, 1);
        });

        it("refuses someone else's, and an id that is not one", async () => {
            const { client, routine, habit } = await setup();
            const other = await setup();
            const theirRoutine = await routine();
            const theirHabit = await habit();
            await client.delete(`/routines/${theirRoutine._id}`);
            await client.delete(`/habits/${theirHabit._id}`);

            assert.equal((await other.client.post(`/routines/${theirRoutine._id}/restore`)).status, 404);
            assert.equal((await other.client.post(`/habits/${theirHabit._id}/restore`)).status, 404);
            assert.equal((await client.post("/routines/nope/restore")).status, 400);
            assert.equal((await client.post("/habits/nope/restore")).status, 400);

            assert.equal((await Routine.findById(theirRoutine._id)).isActive, false);
            assert.equal((await Habit.findById(theirHabit._id)).isActive, false);
        });
    });

    describe("the order of habits", () => {
        it("is the order they were made in until it is changed", async () => {
            const { habit, habitTitles } = await setup();
            await habit({ title: "First" });
            await habit({ title: "Second" });
            await habit({ title: "Third" });

            assert.deepEqual(await habitTitles(), ["First", "Second", "Third"]);
        });

        it("can be changed, and a habit made afterwards goes last", async () => {
            const { client, habit, habitTitles } = await setup();
            const first = await habit({ title: "First" });
            const second = await habit({ title: "Second" });
            const third = await habit({ title: "Third" });

            const response = await client.put("/habits/reorder", {
                habits: [
                    { id: third._id, order: 0 },
                    { id: first._id, order: 1 },
                    { id: second._id, order: 2 },
                ],
            });
            assert.equal(response.status, 200);
            assert.deepEqual(await habitTitles(), ["Third", "First", "Second"]);

            await habit({ title: "Fourth" });
            assert.deepEqual(await habitTitles(), ["Third", "First", "Second", "Fourth"]);
        });

        it("puts a habit moved to another part of the day after the others", async () => {
            const { client, habit, habitTitles } = await setup();
            const first = await habit({ title: "First", timeOfDay: "morning" });
            await habit({ title: "Second", timeOfDay: "evening" });
            await habit({ title: "Third", timeOfDay: "evening" });

            await client.put(`/habits/${first._id}`, { timeOfDay: "evening" });
            assert.deepEqual(await habitTitles(), ["Second", "Third", "First"]);

            // Saving it again where it already is leaves its place alone
            await client.put(`/habits/${first._id}`, { timeOfDay: "evening", title: "First, renamed" });
            await habit({ title: "Fourth", timeOfDay: "evening" });
            assert.deepEqual(await habitTitles(), ["Second", "Third", "First, renamed", "Fourth"]);
        });

        it("cannot move someone else's habits, and checks what it is sent", async () => {
            const { client, habit } = await setup();
            const other = await setup();
            const theirs = await other.habit({ title: "Theirs" });
            const mine = await habit();

            const response = await client.put("/habits/reorder", {
                habits: [{ id: theirs._id, order: 9 }, { id: mine._id, order: 3 }],
            });
            assert.equal(response.status, 200);
            assert.equal((await Habit.findById(theirs._id)).order, 0);
            assert.equal((await Habit.findById(mine._id)).order, 3);

            assert.equal((await client.put("/habits/reorder", {})).status, 400);
            assert.equal((await client.put("/habits/reorder", { habits: [{ id: "nope", order: 1 }] })).status, 400);
            assert.equal((await client.put("/habits/reorder", { habits: [{ id: mine._id, order: -1 }] })).status, 400);
        });
    });

    describe("an item's history", () => {
        it("lists a routine's days as done, late or missed, with totals", async () => {
            const { client, user } = await setup();
            const routine = await Routine.create({ user: user._id, title: "Run", startTime: "06:00", endTime: "07:00", isRecurring: true, recurringDays: EVERY_DAY, createdAt: longAgo });
            const log = (date, fields = {}) =>
                RoutineLog.create({ routine: routine._id, user: user._id, date, completedAt: "06:30", wasOnTime: true, xpEarned: 10, ...fields });

            await log(daysAgo(4));
            await log(daysAgo(3), { wasOnTime: false, xpEarned: 5, completedAt: "09:00" });
            await XPLog.create({ user: user._id, amount: -5, reason: "routine_missed", metadata: { routineId: routine._id, date: daysAgo(2) } });
            await log(daysAgo(1));
            await log(today);

            const response = await client.get(`/routines/${routine._id}/history`);
            assert.equal(response.status, 200);

            const { days, totals, run, since } = response.body;
            assert.equal(response.body.today, today);
            assert.equal(since, daysAgo(365));
            assert.deepEqual(
                days.map((day) => [day.date, day.status]),
                [
                    [daysAgo(4), "done"],
                    [daysAgo(3), "late"],
                    [daysAgo(2), "missed"],
                    [daysAgo(1), "done"],
                    [today, "done"],
                ],
            );
            assert.equal(days[2].xpLost, 5);
            assert.deepEqual(totals, { done: 4, late: 1, missed: 1, xpLost: 5 });
            assert.deepEqual(run, { current: 2, best: 2 });
        });

        it("lists a habit's days as done, partly done or missed", async () => {
            const { client, user } = await setup();
            const habit = await Habit.create({ user: user._id, title: "Read", habitType: "quantity", targetQuantity: 20, unit: "pages", createdAt: longAgo });
            const log = (date, quantity) =>
                HabitLog.create({ habit: habit._id, user: user._id, date, quantity, completed: quantity >= 20 });

            await log(daysAgo(3), 20);
            await log(daysAgo(2), 8);
            // The ledger has held the id as text too
            await XPLog.create({ user: user._id, amount: -5, reason: "habit_missed", metadata: { habitId: habit._id.toString(), date: daysAgo(2) } });
            await XPLog.create({ user: user._id, amount: -5, reason: "habit_missed", metadata: { habitId: habit._id, date: daysAgo(1) } });

            const { days, totals, run } = (await client.get(`/habits/${habit._id}/history`)).body;
            assert.deepEqual(
                days.map((day) => [day.date, day.status, day.quantity]),
                [
                    [daysAgo(3), "done", 20],
                    // Something was logged that day, so it shows as what was logged, though it was charged as missed
                    [daysAgo(2), "partial", 8],
                    [daysAgo(1), "missed", undefined],
                ],
            );
            assert.deepEqual(totals, { done: 1, late: 0, missed: 1, xpLost: 5 });
            assert.deepEqual(run, { current: 0, best: 1 });
        });

        it("is empty for something new", async () => {
            const { client, habit } = await setup();
            const item = await habit();

            const { days, totals, run } = (await client.get(`/habits/${item._id}/history`)).body;
            assert.deepEqual(days, []);
            assert.deepEqual(totals, { done: 0, late: 0, missed: 0, xpLost: 0 });
            assert.deepEqual(run, { current: 0, best: 0 });
        });

        it("counts a run over the days a habit is due, not over the calendar", async () => {
            const { client, user } = await setup();
            // Due on two weekdays only: the one three days ago and the one six days ago fall on them
            const dueDays = [weekdayOf(daysAgo(3)), weekdayOf(daysAgo(6))];
            const habit = await Habit.create({ user: user._id, title: "Swim", frequency: "weekly", targetDays: dueDays, createdAt: longAgo });
            for (const days of [3, 6, 10, 13]) {
                await HabitLog.create({ habit: habit._id, user: user._id, date: daysAgo(days), quantity: 1, completed: true });
            }

            const { run } = (await client.get(`/habits/${habit._id}/history`)).body;
            assert.deepEqual(run, { current: 4, best: 4 });
        });

        it("belongs to its owner, and to something still in the plan", async () => {
            const { client, routine, habit } = await setup();
            const other = await setup();
            const myRoutine = await routine();
            const myHabit = await habit();

            assert.equal((await other.client.get(`/routines/${myRoutine._id}/history`)).status, 404);
            assert.equal((await other.client.get(`/habits/${myHabit._id}/history`)).status, 404);
            assert.equal((await client.get("/habits/nope/history")).status, 400);

            await client.delete(`/routines/${myRoutine._id}`);
            assert.equal((await client.get(`/routines/${myRoutine._id}/history`)).status, 404);
        });
    });
});
