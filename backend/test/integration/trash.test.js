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
import DailyLog from "../../src/models/DailyLog.js";
import XPLog from "../../src/models/XPLog.js";
import ExpenseTransaction from "../../src/models/ExpenseTransaction.js";
import { settleEndedDays } from "../../src/utils/dailyPenaltyJob.js";
import { purgeExpiredTrash } from "../../src/utils/trashKinds.js";

// Trash: what is deleted waits there for as long as its owner chose, comes back exactly as it was,
// and is gone for good after that. A routine's or habit's XP goes into Trash with it.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("trash", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 40 * DAY);

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });
        const { accounts } = (await client.get("/expenses/summary")).body;

        return {
            client,
            user,
            accounts,
            routine: async (fields = {}) =>
                (await client.post("/routines", { title: "Routine", startTime: "00:00", isRecurring: true, recurringDays: EVERY_DAY, ...fields })).body,
            habit: async (fields = {}) =>
                (await client.post("/habits", { title: "Habit", difficulty: "easy", ...fields })).body.habit,
            // Something that stays open, so that no day here is ever one with everything done
            keepDayOpen: () =>
                client.post("/routines", { title: "Stays open", startTime: "23:00", isRecurring: true, recurringDays: EVERY_DAY }),
            spend: async (fields = {}) =>
                (await client.post("/expenses/transactions", { type: "expense", amount: 250, accountId: accounts[0]._id, category: "Travel", description: "Cab", ...fields })).body.transaction,
            xp: async () => (await client.get("/gamification/stats")).body.totalXp,
            trash: async () => (await client.get("/trash")).body,
            restore: (kind, id) => client.post(`/trash/${kind}/${id}/restore`),
            erase: (kind, id) => client.delete(`/trash/${kind}/${id}`),
            // Makes it as if this was put in the plan long ago
            backdate: (model, id) => model.updateOne({ _id: id }, { createdAt: longAgo }),
            reload: () => User.findById(user._id),
        };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        const id = "a".repeat(24);

        assert.equal((await stranger.get("/trash")).status, 401);
        assert.equal((await stranger.delete("/trash")).status, 401);
        assert.equal((await stranger.post(`/trash/routine/${id}/restore`)).status, 401);
        assert.equal((await stranger.delete(`/trash/routine/${id}`)).status, 401);
    });

    describe("a routine or habit", () => {
        it("goes into Trash with the XP it earned, and brings it back", async () => {
            const { client, routine, keepDayOpen, xp, trash, restore } = await setup();
            await keepDayOpen();
            const item = await routine({ title: "Morning run", startTime: "06:00", endTime: "23:59" });
            await client.post(`/routines/${item._id}/complete`, {});
            assert.equal(await xp(), 10);

            const deleted = await client.delete(`/routines/${item._id}`);
            assert.equal(deleted.status, 200);
            assert.equal(deleted.body.xpTaken, 10);
            assert.equal(deleted.body.owed, 0);
            assert.equal(await xp(), 0);
            assert.equal((await client.get("/routines")).body.routines.some((entry) => entry._id === item._id), false);

            const { items, days } = await trash();
            assert.equal(days, 7);
            assert.equal(items.length, 1);
            const [held] = items;
            assert.deepEqual(
                [held.kind, held.id, held.title, held.xp, held.startTime, held.endTime, held.isRecurring],
                ["routine", item._id, "Morning run", 10, "06:00", "23:59", true],
            );
            assert.deepEqual(held.recurringDays, EVERY_DAY);
            assert.equal(Date.parse(held.purgeAt) - Date.parse(held.deletedAt), 7 * DAY);

            const back = await restore("routine", item._id);
            assert.equal(back.status, 200);
            assert.equal(back.body.xpReturned, 10);
            assert.equal(await xp(), 10);
            assert.equal((await trash()).items.length, 0);

            // Exactly as it was: the same routine, still ticked for today
            const listed = (await client.get("/routines")).body.routines.find((entry) => entry._id === item._id);
            assert.equal(listed.title, "Morning run");
            assert.equal(listed.startTime, "06:00");
            assert.ok(listed.todayLog);
        });

        it("takes everything it ever earned, not just today's, and none of what its misses cost", async () => {
            const { client, user, habit, keepDayOpen, trash, restore, reload } = await setup();
            await keepDayOpen();
            const item = await habit({ difficulty: "hard" });
            // Three earlier days done (one from before the amount was kept on the log), and a charge for a miss
            await HabitLog.create([
                { habit: item._id, user: user._id, date: daysAgo(3), completed: true, xpEarned: 25 },
                { habit: item._id, user: user._id, date: daysAgo(2), completed: true, xpEarned: 10 },
                { habit: item._id, user: user._id, date: daysAgo(1), completed: true },
                { habit: item._id, user: user._id, date: daysAgo(5), completed: false, quantity: 0 },
            ]);
            await XPLog.create({ user: user._id, amount: -8, reason: "habit_missed", metadata: { habitId: item._id, date: daysAgo(4) } });
            await User.updateOne({ _id: user._id }, { xp: 500 });

            const deleted = await client.delete(`/habits/${item._id}`);
            assert.equal(deleted.body.xpTaken, 25 + 10 + 25);
            assert.equal((await reload()).xp, 440);
            assert.equal((await trash()).items[0].xp, 60);

            const entry = await XPLog.findOne({ user: user._id, reason: "item_trashed" });
            assert.equal(entry.amount, -60);
            assert.equal(entry.metadata.habitId.toString(), item._id);

            await restore("habit", item._id);
            assert.equal((await reload()).xp, 500);
            assert.equal((await XPLog.findOne({ user: user._id, reason: "item_restored" })).amount, 60);
        });

        it("gives back only what was actually taken from an account that had less", async () => {
            const { client, user, routine, restore, reload } = await setup();
            const item = await routine();
            await RoutineLog.create({ routine: item._id, user: user._id, date: daysAgo(1), completedAt: "08:00", xpEarned: 10 });
            await User.updateOne({ _id: user._id }, { xp: 4 });

            assert.equal((await client.delete(`/routines/${item._id}`)).body.xpTaken, 4);
            assert.equal((await reload()).xp, 0);

            await User.updateOne({ _id: user._id }, { xp: 50 });
            assert.equal((await restore("routine", item._id)).body.xpReturned, 4);
            assert.equal((await reload()).xp, 54);
        });

        it("returns the coins of a level the delete takes away, and pays them again on recovery", async () => {
            const { client, user, routine, keepDayOpen, restore, reload } = await setup();
            await keepDayOpen();
            const item = await routine();
            await RoutineLog.create({ routine: item._id, user: user._id, date: daysAgo(1), completedAt: "08:00", xpEarned: 10 });
            // Level 2 starts at 100 XP and paid 100 coins
            await User.updateOne({ _id: user._id }, { xp: 105, level: 2, coins: 100 });

            await client.delete(`/routines/${item._id}`);
            let account = await reload();
            assert.deepEqual([account.xp, account.coins], [95, 0]);

            await restore("routine", item._id);
            account = await reload();
            assert.deepEqual([account.xp, account.coins], [105, 100]);
        });

        it("takes its XP once when two deletes arrive together, and returns it once", async () => {
            const { client, user, routine, keepDayOpen, restore, reload } = await setup();
            await keepDayOpen();
            const item = await routine();
            await RoutineLog.create({ routine: item._id, user: user._id, date: daysAgo(1), completedAt: "08:00", xpEarned: 10 });
            await User.updateOne({ _id: user._id }, { xp: 100 });

            const both = await Promise.all([client.delete(`/routines/${item._id}`), client.delete(`/routines/${item._id}`)]);
            assert.deepEqual(both.map((response) => response.status).sort(), [200, 404]);
            assert.equal((await reload()).xp, 90);

            const backs = await Promise.all([restore("routine", item._id), restore("routine", item._id)]);
            assert.deepEqual(backs.map((response) => response.status).sort(), [200, 404]);
            assert.equal((await reload()).xp, 100);
        });

        it("cannot be changed, ticked or un-ticked while it is in Trash", async () => {
            const { client, routine, habit, keepDayOpen } = await setup();
            await keepDayOpen();
            const task = await routine();
            const kept = await habit();
            await client.post(`/routines/${task._id}/complete`, {});
            await client.delete(`/routines/${task._id}`);
            await client.delete(`/habits/${kept._id}`);

            assert.equal((await client.put(`/routines/${task._id}`, { title: "Renamed" })).status, 404);
            assert.equal((await client.delete(`/routines/${task._id}/complete`, {})).status, 404);
            assert.equal((await client.put(`/habits/${kept._id}`, { title: "Renamed" })).status, 404);
            assert.equal((await client.put(`/habits/${kept._id}/log`, { quantity: 1 })).status, 404);
            assert.equal((await client.get(`/habits/${kept._id}/history`)).status, 404);
        });

        it("comes back through its own restore route as well", async () => {
            const { client, routine, habit, trash } = await setup();
            const task = await routine();
            const kept = await habit();
            await client.delete(`/routines/${task._id}`);
            await client.delete(`/habits/${kept._id}`);
            assert.equal((await trash()).items.length, 2);

            assert.equal((await client.post(`/routines/${task._id}/restore`)).body.isActive, true);
            assert.equal((await client.post(`/habits/${kept._id}/restore`)).body.habit.isActive, true);
            assert.equal((await trash()).items.length, 0);

            // Only what is in Trash can be brought back
            assert.equal((await client.post(`/routines/${task._id}/restore`)).status, 404);
        });

        it("cannot be brought back if it was deleted before Trash existed", async () => {
            const { client, user, restore, trash } = await setup();
            const old = await Routine.create({ user: user._id, title: "Old", startTime: "08:00", isActive: false });

            assert.equal((await trash()).items.length, 0);
            assert.equal((await restore("routine", old._id)).status, 404);
            assert.equal((await client.post(`/routines/${old._id}/restore`)).status, 404);
        });
    });

    describe("deleting something that is still owed today", () => {
        // The day after tomorrow, as the settlement sees it: today and tomorrow have both closed by then
        const later = () => new Date(Date.now() + 2 * DAY);
        const chargedFor = async (user, id) =>
            (await XPLog.find({ user: user._id, reason: /_missed$/ }))
                .filter((entry) => (entry.metadata.routineId ?? entry.metadata.habitId).toString() === id)
                .map((entry) => `${entry.metadata.date} ${entry.amount}`);

        it("is still charged tonight, once, and says so", async () => {
            const { client, user, routine, habit, backdate, reload } = await setup();
            const task = await routine();
            const kept = await habit();
            await backdate(Routine, task._id);
            await backdate(Habit, kept._id);
            await User.updateOne({ _id: user._id }, { xp: 200 });

            assert.equal((await client.delete(`/routines/${task._id}`)).body.owed, 5);
            assert.equal((await client.delete(`/habits/${kept._id}`)).body.owed, 3);

            // Today is told what it still owes, by name
            const { owed } = (await client.get("/streaks/info")).body;
            assert.deepEqual(
                owed.map((item) => [item.kind, item.id, item.title, item.xp]),
                [["routine", task._id, "Routine", 5], ["habit", kept._id, "Habit", 3]],
            );

            // The day still asks for them, so it is not a day with nothing due
            const summary = await DailyLog.findOne({ user: user._id, date: today });
            assert.deepEqual([summary.totalRoutines, summary.totalHabits, summary.isRestDay], [1, 1, false]);

            await settleEndedDays(await reload(), later());

            // Charged for today, and for no day after it
            assert.deepEqual(await chargedFor(user, task._id), [`${today} -5`]);
            assert.deepEqual(await chargedFor(user, kept._id), [`${today} -3`]);
            assert.equal((await reload()).xp, 192);
        });

        it("costs nothing if it was made today", async () => {
            const { client, user, routine, habit, reload } = await setup();
            const task = await routine();
            const kept = await habit();
            await User.updateOne({ _id: user._id }, { xp: 200 });

            assert.equal((await client.delete(`/routines/${task._id}`)).body.owed, 0);
            assert.equal((await client.delete(`/habits/${kept._id}`)).body.owed, 0);
            assert.deepEqual((await client.get("/streaks/info")).body.owed, []);

            await settleEndedDays(await reload(), later());
            assert.equal(await XPLog.countDocuments({ user: user._id, reason: /_missed$/ }), 0);
            assert.equal((await reload()).xp, 200);
        });

        it("costs nothing if it was done, or was not due today", async () => {
            const { client, user, routine, keepDayOpen, backdate, reload } = await setup();
            const done = await routine({ title: "Done" });
            const tomorrowOnly = await routine({ title: "Not today", isRecurring: false, recurringDays: [], date: addDays(today, 1) });
            await backdate(Routine, done._id);
            await backdate(Routine, tomorrowOnly._id);
            await client.post(`/routines/${done._id}/complete`, {});
            await (await keepDayOpen());

            assert.equal((await client.delete(`/routines/${done._id}`)).body.owed, 0);
            assert.equal((await client.delete(`/routines/${tomorrowOnly._id}`)).body.owed, 0);

            await settleEndedDays(await reload(), later());
            assert.deepEqual(await chargedFor(user, done._id), []);
            assert.deepEqual(await chargedFor(user, tomorrowOnly._id), []);
        });

        it("keeps the day from being one with everything done", async () => {
            const { client, routine, backdate, xp } = await setup();
            const done = await routine({ title: "Done" });
            const left = await routine({ title: "Left" });
            await backdate(Routine, left._id);

            await client.delete(`/routines/${left._id}`);
            await client.post(`/routines/${done._id}/complete`, {});

            // 10 for the routine, and no bonus: what was deleted is still owed
            assert.equal(await xp(), 10);

            // Recovered and done after all, the day is complete
            await client.post(`/routines/${left._id}/restore`);
            await client.post(`/routines/${left._id}/complete`, {});
            assert.equal(await xp(), 40);
        });
    });

    describe("money", () => {
        it("stops counting while it is in Trash and comes back as the same record", async () => {
            const { client, spend, trash, restore } = await setup();
            const cab = await spend({ amount: 250, placeName: "Station" });
            const month = today.slice(0, 7);
            const total = async () => (await client.get("/expenses/summary")).body.monthExpensesTotal;
            const listed = async () =>
                (await client.get(`/expenses/transactions?month=${month}`)).body.transactions.map((entry) => entry._id);
            assert.equal(await total(), 250);

            const deleted = await client.delete(`/expenses/transactions/${cab._id}`);
            assert.equal(deleted.status, 200);
            assert.ok(deleted.body.purgeAt);
            assert.equal(await total(), 0);
            assert.deepEqual(await listed(), []);
            assert.equal((await client.get(`/expenses/export?month=${month}`)).text.includes("Station"), false);
            // It is not there to edit or delete again
            assert.equal((await client.put(`/expenses/transactions/${cab._id}`, { amount: 1 })).status, 404);
            assert.equal((await client.delete(`/expenses/transactions/${cab._id}`)).status, 404);

            const [held] = (await trash()).items;
            assert.deepEqual(
                [held.kind, held.id, held.title, held.amount, held.type, held.category, held.placeName, held.account],
                ["transaction", cab._id, "Cab", 250, "expense", "Travel", "Station", "Bank"],
            );

            assert.equal((await restore("transaction", cab._id)).status, 200);
            assert.equal(await total(), 250);
            assert.deepEqual(await listed(), [cab._id]);
        });

        it("holds a subscription the same way", async () => {
            const { client, accounts, trash, restore } = await setup();
            const created = await client.post("/expenses/subscriptions", { name: "Music", amount: 119, frequency: "monthly", accountId: accounts[0]._id });
            const id = created.body.subscription._id;
            const names = async () => (await client.get("/expenses/subscriptions")).body.subscriptions.map((entry) => entry.name);

            assert.equal((await client.delete(`/expenses/subscriptions/${id}`)).status, 200);
            assert.deepEqual(await names(), []);
            assert.equal((await client.put(`/expenses/subscriptions/${id}`, { amount: 1 })).status, 404);

            const [held] = (await trash()).items;
            assert.deepEqual([held.kind, held.title, held.amount, held.frequency], ["subscription", "Music", 119, "monthly"]);

            await restore("subscription", id);
            assert.deepEqual(await names(), ["Music"]);
        });
    });

    describe("how long things are kept", () => {
        it("is a week unless the account chooses one day or three", async () => {
            const { client, spend, trash } = await setup();
            assert.equal((await client.get("/auth/me")).body.user.trashDays, 7);

            const changed = await client.put("/auth/me", { trashDays: 3 });
            assert.equal(changed.status, 200);
            assert.equal(changed.body.user.trashDays, 3);

            const cab = await spend();
            await client.delete(`/expenses/transactions/${cab._id}`);
            const { days, items } = await trash();
            assert.equal(days, 3);
            assert.equal(Date.parse(items[0].purgeAt) - Date.parse(items[0].deletedAt), 3 * DAY);

            for (const trashDays of [0, 2, 14, "week", null]) {
                assert.equal((await client.put("/auth/me", { trashDays })).status, 400, String(trashDays));
            }
        });

        it("is fixed for each thing as it is deleted: a shorter setting later erases nothing early", async () => {
            const { client, spend, trash } = await setup();
            const cab = await spend();
            await client.delete(`/expenses/transactions/${cab._id}`);

            await client.put("/auth/me", { trashDays: 1 });
            const [held] = (await trash()).items;
            assert.equal(Date.parse(held.purgeAt) - Date.parse(held.deletedAt), 7 * DAY);
        });
    });

    describe("when its time runs out", () => {
        const expire = (model, id) => model.updateOne({ _id: id }, { purgeAt: new Date(Date.now() - 1000) });

        it("a routine can no longer be recovered, its XP stays gone, and past days still name it", async () => {
            const { client, user, routine, keepDayOpen, trash, restore, reload } = await setup();
            await keepDayOpen();
            const item = await routine({ title: "Morning run" });
            await RoutineLog.create({ routine: item._id, user: user._id, date: daysAgo(1), completedAt: "08:00", xpEarned: 10 });
            await User.updateOne({ _id: user._id }, { xp: 100 });
            await client.delete(`/routines/${item._id}`);
            await expire(Routine, item._id);

            assert.equal((await trash()).items.length, 0);
            assert.equal((await restore("routine", item._id)).status, 404);
            assert.equal((await client.post(`/routines/${item._id}/restore`)).status, 404);
            assert.equal((await reload()).xp, 90);

            const kept = await Routine.findById(item._id);
            assert.ok(kept.purgedAt);
            assert.equal(kept.isActive, false);

            const day = (await client.get(`/history/days/${daysAgo(1)}`)).body;
            assert.deepEqual(
                day.items.map((entry) => [entry.title, entry.status, entry.active]),
                [["Morning run", "done", false]],
            );
        });

        it("anything else is removed, by the sweep, for every account at once", async () => {
            const first = await setup();
            const second = await setup();
            const mine = await first.spend();
            const theirs = await second.spend();
            const staying = await second.spend({ description: "Stays" });
            for (const [account, transaction] of [[first, mine], [second, theirs], [second, staying]]) {
                await account.client.delete(`/expenses/transactions/${transaction._id}`);
            }
            await expire(ExpenseTransaction, mine._id);
            await expire(ExpenseTransaction, theirs._id);

            await purgeExpiredTrash();

            assert.equal(await ExpenseTransaction.countDocuments({ _id: { $in: [mine._id, theirs._id] } }), 0);
            assert.deepEqual((await second.trash()).items.map((item) => item.title), ["Stays"]);
        });
    });

    describe("letting go by hand", () => {
        it("erases one thing, or everything, and only the user's own", async () => {
            const { client, routine, spend, trash, erase } = await setup();
            const other = await setup();
            const task = await routine();
            const cab = await spend();
            const bus = await spend({ description: "Bus" });
            const theirs = await other.spend();
            await client.delete(`/routines/${task._id}`);
            await client.delete(`/expenses/transactions/${cab._id}`);
            await client.delete(`/expenses/transactions/${bus._id}`);
            await other.client.delete(`/expenses/transactions/${theirs._id}`);
            assert.equal((await trash()).items.length, 3);

            // Someone else's is not there to erase or to bring back
            assert.equal((await erase("transaction", theirs._id)).status, 404);
            assert.equal((await client.post(`/trash/transaction/${theirs._id}/restore`)).status, 404);

            assert.equal((await erase("transaction", cab._id)).status, 200);
            assert.equal(await ExpenseTransaction.countDocuments({ _id: cab._id }), 0);
            assert.equal((await erase("transaction", cab._id)).status, 404);
            assert.equal((await trash()).items.length, 2);

            const emptied = await client.delete("/trash");
            assert.equal(emptied.status, 200);
            assert.equal(emptied.body.erased, 2);
            assert.equal((await trash()).items.length, 0);
            assert.ok((await Routine.findById(task._id)).purgedAt);

            assert.equal((await other.trash()).items.length, 1);
        });

        it("refuses a kind Trash does not hold, and an id that is not one", async () => {
            const { client } = await setup();
            const id = "a".repeat(24);

            assert.equal((await client.post(`/trash/account/${id}/restore`)).status, 400);
            assert.equal((await client.delete(`/trash/user/${id}`)).status, 400);
            assert.equal((await client.post("/trash/routine/nope/restore")).status, 400);
            assert.equal((await client.post(`/trash/routine/${id}/restore`)).status, 404);
        });
    });

    it("lists the most recently deleted first, whatever its kind", async () => {
        const { client, routine, habit, spend, trash } = await setup();
        const task = await routine({ title: "First" });
        const cab = await spend({ description: "Second" });
        const kept = await habit({ title: "Third" });

        await client.delete(`/routines/${task._id}`);
        await client.delete(`/expenses/transactions/${cab._id}`);
        await client.delete(`/habits/${kept._id}`);

        assert.deepEqual((await trash()).items.map((item) => item.title), ["Third", "Second", "First"]);
    });

    it("is emptied with the account", async () => {
        const client = createClient({ timezone: TZ });
        const account = await client.register();
        const user = await User.findOne({ email: account.email });
        const made = (await client.post("/routines", { title: "Routine", startTime: "08:00", isRecurring: true, recurringDays: EVERY_DAY })).body;
        await client.delete(`/routines/${made._id}`);

        assert.equal((await client.post("/auth/delete-account", { password: account.password })).status, 200);
        assert.equal(await Routine.countDocuments({ user: user._id }), 0);
    });
});
