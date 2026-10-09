import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    addDays,
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import User from "../../src/models/User.js";

// What the Today screen needs from habits: which block each sits in, which are due today,
// and a count for today that can be set, lowered and cleared, with the XP following it both ways.

const TZ = "Asia/Kolkata";

describe("habits on today", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const todaysWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();

        // A day with everything done pays a bonus. One routine left open keeps that out of these sums.
        await client.post("/routines", { title: "Keeps the day from being perfect", startTime: "23:00", isRecurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6] });

        return {
            client,
            email,
            stats: async () => (await client.get("/gamification/stats")).body,
            habit: async (fields = {}) =>
                (await client.post("/habits", { title: "Habit", difficulty: "easy", ...fields })).body.habit,
            set: (habit, quantity) => client.put(`/habits/${habit._id}/log`, { quantity }),
            listed: async (habit) =>
                (await client.get("/habits")).body.habits.find((item) => item._id === habit._id),
            todaysSummary: async () =>
                (await client.get("/streaks/logs?days=3")).body.logs.find((log) => log.date === today),
        };
    };

    describe("the part of the day a habit sits in", () => {
        it("is anytime unless chosen, and can be changed", async () => {
            const { client, habit, listed } = await setup();

            const plain = await habit();
            assert.equal(plain.timeOfDay, "anytime");

            const chosen = await habit({ timeOfDay: "morning" });
            assert.equal(chosen.timeOfDay, "morning");

            const moved = await client.put(`/habits/${plain._id}`, { timeOfDay: "evening" });
            assert.equal(moved.status, 200);
            assert.equal((await listed(plain)).timeOfDay, "evening");
        });

        it("is one of the four the app knows", async () => {
            const { client, habit } = await setup();
            const item = await habit();

            assert.equal((await client.post("/habits", { title: "x", timeOfDay: "night" })).status, 400);
            assert.equal((await client.put(`/habits/${item._id}`, { timeOfDay: "06:30" })).status, 400);
        });

        it("reads as anytime for a habit saved before the field existed", async () => {
            const { habit, listed } = await setup();
            const old = await habit();
            // Straight into the collection, past the model, which would put the default back
            await Habit.collection.updateOne(
                { _id: new mongoose.Types.ObjectId(old._id) },
                { $unset: { timeOfDay: "" } },
            );

            assert.equal((await listed(old)).timeOfDay, "anytime");
        });
    });

    describe("the list of habits", () => {
        it("says which are due today, and what day the server counts as today", async () => {
            const { client, habit, listed } = await setup();
            const daily = await habit();
            const onToday = await habit({ frequency: "weekly", targetDays: [todaysWeekday] });
            const onAnotherDay = await habit({ frequency: "weekly", targetDays: [(todaysWeekday + 3) % 7] });
            const weeklyNoDays = await habit({ frequency: "weekly", targetDays: [] });

            assert.equal((await client.get("/habits")).body.today, today);
            assert.equal((await listed(daily)).dueToday, true);
            assert.equal((await listed(onToday)).dueToday, true);
            assert.equal((await listed(onAnotherDay)).dueToday, false);
            assert.equal((await listed(weeklyNoDays)).dueToday, true);
        });
    });

    describe("setting today's count", () => {
        it("ticks and un-ticks a yes-or-no habit, paying its XP and taking it back", async () => {
            const { habit, set, stats, listed } = await setup();
            const item = await habit({ difficulty: "hard" });

            const ticked = await set(item, 1);
            assert.equal(ticked.status, 200);
            assert.equal(ticked.body.justCompleted, true);
            assert.equal(ticked.body.log.completed, true);
            assert.deepEqual(
                [ticked.body.habit.currentStreak, ticked.body.habit.bestStreak, ticked.body.habit.totalCompletions],
                [1, 1, 1],
            );
            assert.equal((await stats()).totalXp, 25);

            const unticked = await set(item, 0);
            assert.equal(unticked.status, 200);
            assert.equal(unticked.body.justUncompleted, true);
            assert.equal(unticked.body.log, null);
            assert.deepEqual(
                [unticked.body.habit.currentStreak, unticked.body.habit.bestStreak, unticked.body.habit.totalCompletions],
                [0, 0, 0],
            );
            assert.equal((await stats()).totalXp, 0);
            assert.equal((await listed(item)).todayLog, null);
        });

        it("changes nothing when the same count is sent again", async () => {
            const { habit, set, stats } = await setup();
            const item = await habit();

            await set(item, 1);
            const again = await set(item, 1);
            assert.equal(again.body.justCompleted, false);
            assert.equal(again.body.reward, null);
            assert.equal((await stats()).totalXp, 10);

            await set(item, 0);
            const clearedAgain = await set(item, 0);
            assert.equal(clearedAgain.status, 200);
            assert.equal(clearedAgain.body.justUncompleted, false);
            assert.equal((await stats()).totalXp, 0);

            // And round again: nothing was left behind to be paid twice
            await set(item, 1);
            assert.equal((await stats()).totalXp, 10);
        });

        it("steps a counted habit up and down across its target", async () => {
            const { habit, set, stats } = await setup();
            const water = await habit({ habitType: "quantity", targetQuantity: 8, unit: "glasses" });

            const partway = await set(water, 5);
            assert.deepEqual([partway.body.log.quantity, partway.body.log.completed], [5, false]);
            assert.equal(partway.body.justCompleted, false);
            assert.equal((await stats()).totalXp, 0);

            const reached = await set(water, 8);
            assert.deepEqual([reached.body.log.quantity, reached.body.log.completed], [8, true]);
            assert.equal(reached.body.justCompleted, true);
            assert.equal((await stats()).totalXp, 10);

            const beyond = await set(water, 9);
            assert.deepEqual([beyond.body.log.quantity, beyond.body.log.completed], [9, true]);
            assert.equal(beyond.body.justCompleted, false);
            assert.equal((await stats()).totalXp, 10);

            const back = await set(water, 7);
            assert.deepEqual([back.body.log.quantity, back.body.log.completed], [7, false]);
            assert.equal(back.body.justUncompleted, true);
            assert.equal((await stats()).totalXp, 0);

            const reachedAgain = await set(water, 8);
            assert.equal(reachedAgain.body.justCompleted, true);
            assert.equal((await stats()).totalXp, 10);
        });

        it("works alongside the older add-to-the-count request", async () => {
            const { client, habit, set, stats } = await setup();
            const water = await habit({ habitType: "quantity", targetQuantity: 3 });

            await client.post(`/habits/${water._id}/log`, { quantity: 2 });
            const reached = await client.post(`/habits/${water._id}/log`, { quantity: 1 });
            assert.equal(reached.body.justCompleted, true);
            assert.equal(reached.body.log.xpEarned, 10);

            const back = await set(water, 2);
            assert.equal(back.body.justUncompleted, true);
            assert.equal((await stats()).totalXp, 0);
        });

        it("takes back what the completion paid, even if the habit is worth more by then", async () => {
            const { client, habit, set, stats } = await setup();
            const other = await habit({ difficulty: "hard" });
            const item = await habit({ difficulty: "easy" });

            await set(other, 1);
            await set(item, 1);
            assert.equal((await stats()).totalXp, 35);

            await client.put(`/habits/${item._id}`, { difficulty: "hard" });
            await set(item, 0);
            assert.equal((await stats()).totalXp, 25);
        });

        it("returns the coins of a level that the undo takes away", async () => {
            const { habit, set, stats } = await setup();
            const items = [];
            for (let i = 0; i < 4; i++) items.push(await habit({ title: `Hard ${i}`, difficulty: "hard" }));

            for (const item of items) await set(item, 1);
            const up = await stats();
            assert.deepEqual([up.level, up.totalXp, up.coins], [2, 100, 100]);

            await set(items[3], 0);
            const down = await stats();
            assert.deepEqual([down.level, down.totalXp, down.coins], [1, 75, 0]);
        });

        it("keeps the day's summary in step both ways", async () => {
            const { habit, set, stats, todaysSummary } = await setup();
            const first = await habit();
            await habit({ title: "Second" });

            await set(first, 1);
            let summary = await todaysSummary();
            assert.deepEqual([summary.totalHabits, summary.completedHabits], [2, 1]);
            assert.equal(summary.xpEarned, (await stats()).totalXp);

            await set(first, 0);
            summary = await todaysSummary();
            assert.deepEqual([summary.totalHabits, summary.completedHabits], [2, 0]);
            assert.equal(summary.xpEarned, 0);
        });

        it("puts the streak back where it stood before today's tick", async () => {
            const { email, habit, set } = await setup();
            const item = await habit();
            const user = await User.findOne({ email });
            await HabitLog.create([
                { habit: item._id, user: user._id, date: addDays(today, -2) },
                { habit: item._id, user: user._id, date: addDays(today, -1) },
            ]);

            const ticked = await set(item, 1);
            assert.deepEqual([ticked.body.habit.currentStreak, ticked.body.habit.bestStreak], [3, 3]);

            // Yesterday's run is still alive today, so the streak falls back to it, not to nothing
            const unticked = await set(item, 0);
            assert.deepEqual(
                [unticked.body.habit.currentStreak, unticked.body.habit.bestStreak, unticked.body.habit.totalCompletions],
                [2, 2, 2],
            );
        });

        it("pays once when the same tick arrives twice at the same moment", async () => {
            const { habit, set, stats } = await setup();
            const item = await habit();

            const both = await Promise.all([set(item, 1), set(item, 1)]);
            assert.ok(both.every((response) => response.status === 200));
            assert.equal(both.filter((response) => response.body.justCompleted).length, 1);
            assert.equal((await stats()).totalXp, 10);
        });

        it("refuses a missing or negative count, and a habit that is gone", async () => {
            const { client, habit, set } = await setup();
            const item = await habit();

            assert.equal((await client.put(`/habits/${item._id}/log`, {})).status, 400);
            assert.equal((await set(item, -1)).status, 400);
            assert.equal((await set(item, { $gt: 0 })).status, 400);

            await client.delete(`/habits/${item._id}`);
            assert.equal((await set(item, 1)).status, 404);
        });
    });
});
