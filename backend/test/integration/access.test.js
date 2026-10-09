import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";

// What a client may and may not change, and that one user can never reach another's data

describe("access rules", { skip: skipWithoutDatabase }, () => {
    let alice;
    let bob;
    const today = todayIn("Asia/Kolkata");
    const OTHER_OWNER = "000000000000000000000001";

    before(async () => {
        await startApp();
        alice = createClient();
        bob = createClient();
        await alice.register();
        await bob.register();
    });
    after(stopApp);

    const newRoutine = async (client, fields = {}) =>
        (await client.post("/routines", { title: "Routine", startTime: "08:00", endTime: "23:59", isRecurring: false, recurringDays: [], date: today, ...fields })).body;
    const newHabit = async (client, fields = {}) =>
        (await client.post("/habits", { title: "Habit", difficulty: "easy", ...fields })).body.habit;

    describe("fields only the server sets", () => {
        it("ignores a client-chosen XP reward, owner or deleted flag on a routine", async () => {
            const created = await alice.post("/routines", { title: "Greedy", startTime: "09:00", xpReward: 5000, user: OTHER_OWNER, isActive: false });
            assert.equal(created.status, 201);
            assert.equal(created.body.xpReward, 10);
            assert.notEqual(created.body.user, OTHER_OWNER);
            assert.equal(created.body.isActive, true);

            const onlyProtected = await alice.put(`/routines/${created.body._id}`, { xpReward: 123456, user: OTHER_OWNER });
            assert.equal(onlyProtected.status, 400);

            const mixed = await alice.put(`/routines/${created.body._id}`, { title: "Still mine", xpReward: 123456, user: OTHER_OWNER });
            assert.equal(mixed.status, 200);
            assert.equal(mixed.body.title, "Still mine");
            assert.equal(mixed.body.xpReward, 10);
            assert.notEqual(mixed.body.user, OTHER_OWNER);
        });

        it("ignores a client-chosen XP reward or streak on a habit", async () => {
            const habit = await newHabit(alice);
            assert.equal(habit.xpReward, 10);

            const onlyProtected = await alice.put(`/habits/${habit._id}`, { xpReward: 9999, bestStreak: 500, totalCompletions: 777 });
            assert.equal(onlyProtected.status, 400);

            const mixed = await alice.put(`/habits/${habit._id}`, { unit: "pages", xpReward: 9999, bestStreak: 500 });
            assert.equal(mixed.body.habit.xpReward, 10);
            assert.equal(mixed.body.habit.bestStreak, 0);
        });

        it("recalculates a habit's XP reward when its difficulty changes", async () => {
            const habit = await newHabit(alice, { difficulty: "easy" });
            const harder = await alice.put(`/habits/${habit._id}`, { difficulty: "hard" });
            assert.equal(harder.body.habit.xpReward, 25);
        });
    });

    describe("one user's data is invisible to another", () => {
        it("for habits", async () => {
            const habit = await newHabit(alice, { title: "Alice only" });

            const bobsHabits = (await bob.get("/habits")).body.habits;
            assert.ok(!bobsHabits.some((item) => item._id === habit._id));
            assert.equal((await bob.put(`/habits/${habit._id}`, { title: "Taken" })).status, 404);
            assert.equal((await bob.post(`/habits/${habit._id}/log`, { quantity: 1 })).status, 404);
            assert.equal((await bob.put(`/habits/${habit._id}/log`, { quantity: 1 })).status, 404);
            assert.equal((await bob.delete(`/habits/${habit._id}`)).status, 404);

            const stillThere = (await alice.get("/habits")).body.habits.find((item) => item._id === habit._id);
            assert.equal(stillThere.title, "Alice only");
        });

        it("for routines", async () => {
            const routine = await newRoutine(alice, { title: "Alice only" });

            const bobsRoutines = (await bob.get(`/routines?date=${today}`)).body.routines;
            assert.ok(!bobsRoutines.some((item) => item._id === routine._id));
            assert.equal((await bob.put(`/routines/${routine._id}`, { title: "Taken" })).status, 404);
            assert.equal((await bob.post(`/routines/${routine._id}/complete`, { date: today })).status, 404);
            assert.equal((await bob.delete(`/routines/${routine._id}`)).status, 404);
        });

        it("for expenses, including accounts referenced by id", async () => {
            const aliceAccounts = (await alice.get("/expenses/summary")).body.accounts;
            const bobAccounts = (await bob.get("/expenses/summary")).body.accounts;

            const transaction = await alice.post("/expenses/transactions", { type: "expense", amount: 50, accountId: aliceAccounts[0]._id });
            assert.equal(transaction.status, 201);
            const id = transaction.body.transaction._id;

            assert.equal((await bob.put(`/expenses/transactions/${id}`, { amount: 1 })).status, 404);
            assert.equal((await bob.delete(`/expenses/transactions/${id}`)).status, 404);
            assert.equal((await bob.put(`/expenses/accounts/${aliceAccounts[0]._id}`, { openingBalance: 0 })).status, 404);

            // Alice can't attach Bob's account to her own records and read its details back
            const transfer = await alice.post("/expenses/transactions", { type: "transfer", amount: 5, accountId: aliceAccounts[0]._id, transferToAccountId: bobAccounts[0]._id });
            assert.equal(transfer.status, 404);
            assert.equal((await alice.put(`/expenses/transactions/${id}`, { accountId: bobAccounts[0]._id })).status, 404);

            const subscription = await alice.post("/expenses/subscriptions", { name: "Music", amount: 119, accountId: aliceAccounts[0]._id });
            assert.equal(subscription.status, 201);
            const moved = await alice.put(`/expenses/subscriptions/${subscription.body.subscription._id}`, { accountId: bobAccounts[0]._id });
            assert.equal(moved.status, 404);
        });
    });

    describe("bad input", () => {
        it("gets a clean 400 with no internal details", async () => {
            const malformedId = await alice.put("/habits/not-an-id", { title: "x" });
            assert.equal(malformedId.status, 400);
            assert.deepEqual(malformedId.body, { success: false, message: '"id" is not a valid id.' });

            const operator = await alice.post(`/habits/${(await newHabit(alice))._id}/log`, { date: { $ne: "x" } });
            assert.equal(operator.status, 400);
            assert.equal(operator.body.error, undefined);

            assert.equal((await alice.get("/streaks/logs?days=100000000")).status, 400);
            assert.equal((await alice.post("/routines", { title: "x", startTime: "25:99" })).status, 400);
        });

        it("does not crash the place search on special characters", async () => {
            const response = await alice.get("/expenses/places?search=(");
            assert.equal(response.status, 200);
            assert.deepEqual(response.body.places, []);
        });
    });

    describe("expenses", () => {
        it("moves a transaction to the right month when its date is edited", async () => {
            const [account] = (await alice.get("/expenses/summary")).body.accounts;
            const created = await alice.post("/expenses/transactions", { type: "expense", amount: 250, accountId: account._id, transactionDate: "2026-10-08" });
            assert.equal(created.body.transaction.monthKey, "2026-10");

            const moved = await alice.put(`/expenses/transactions/${created.body.transaction._id}`, { transactionDate: "2026-08-15", amount: 300 });
            assert.equal(moved.body.transaction.monthKey, "2026-08");
            assert.equal(moved.body.transaction.amount, 300);
        });

        it("exports formula-like text as plain text", async () => {
            const [account] = (await alice.get("/expenses/summary")).body.accounts;
            await alice.post("/expenses/transactions", {
                type: "expense",
                amount: 42,
                accountId: account._id,
                description: '=HYPERLINK("http://example.com","click")',
                placeName: "@home",
                notes: "+1 for the team",
                transactionDate: "2026-06-15",
            });

            const csv = (await alice.get("/expenses/export?month=2026-06")).text;
            const row = csv.split("\n").find((line) => line.includes("HYPERLINK"));
            assert.ok(row.startsWith("2026-06-15,expense,"));
            assert.ok(row.includes(`"'=HYPERLINK(`));
            assert.ok(row.includes(",'@home,"));
            assert.ok(row.includes(",'+1 for the team"));
            assert.ok(row.includes(",42,"));
        });
    });
});
