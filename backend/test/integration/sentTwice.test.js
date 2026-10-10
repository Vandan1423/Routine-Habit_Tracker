import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createClient, skipWithoutDatabase, startApp, stopApp } from "../helpers/app.js";
import User from "../../src/models/User.js";
import Todo from "../../src/models/Todo.js";
import TodoList from "../../src/models/TodoList.js";
import Routine from "../../src/models/Routine.js";
import Habit from "../../src/models/Habit.js";
import Goal from "../../src/models/Goal.js";
import ExpenseTransaction from "../../src/models/ExpenseTransaction.js";
import ExpenseSubscription from "../../src/models/ExpenseSubscription.js";
import KnownSpendPlace from "../../src/models/KnownSpendPlace.js";

// A request that makes something may arrive twice (its answer was lost, or the app sent it again when it
// next opened). With the same Idempotency-Key the thing is made once, and both requests are told of it.

describe("a request that makes something, sent twice", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient();
        const { email } = await client.register();
        const user = await User.findOne({ email });
        const keyed = (key) => ({ headers: { "Idempotency-Key": key } });

        return { client, user, keyed };
    };

    it("makes one to-do, one list, one routine, one habit and one goal", async () => {
        const { client, user, keyed } = await setup();
        const twice = async (path, body, key) => [
            await client.post(path, body, keyed(key)),
            await client.post(path, body, keyed(key)),
        ];

        const todos = await twice("/todos", { title: "Once" }, "key-todo-0001");
        assert.deepEqual(todos.map((answer) => answer.status), [201, 201]);
        assert.equal(todos[0].body.todo._id, todos[1].body.todo._id);
        assert.equal(await Todo.countDocuments({ user: user._id }), 1);

        const lists = await twice("/todos/lists", { name: "Trip" }, "key-list-0001");
        assert.equal(lists[0].body.list._id, lists[1].body.list._id);
        assert.equal(await TodoList.countDocuments({ user: user._id, isDefault: false }), 1);

        const routines = await twice("/routines", { title: "Run", startTime: "07:00", endTime: "07:30" }, "key-routine-01");
        assert.deepEqual(routines.map((answer) => answer.status), [201, 201]);
        assert.equal(routines[0].body._id, routines[1].body._id);
        assert.equal(await Routine.countDocuments({ user: user._id }), 1);

        const habits = await twice("/habits", { title: "Read" }, "key-habit-0001");
        assert.deepEqual(habits.map((answer) => answer.status), [201, 201]);
        assert.equal(habits[0].body.habit._id, habits[1].body.habit._id);
        assert.equal(await Habit.countDocuments({ user: user._id }), 1);

        const goals = await twice("/goals", { title: "A marathon", milestones: [{ title: "10 km" }] }, "key-goal-00001");
        assert.deepEqual(goals.map((answer) => answer.status), [201, 201]);
        assert.equal(goals[0].body.goal._id, goals[1].body.goal._id);
        assert.equal(await Goal.countDocuments({ user: user._id }), 1);
    });

    it("logs one transaction, counts its place once, and keeps one subscription", async () => {
        const { client, user, keyed } = await setup();
        const [account] = (await client.get("/expenses/accounts")).body.accounts;
        const expense = { type: "expense", amount: 120, accountId: account._id, category: "Food & Dining", placeName: "Cafe" };

        const first = await client.post("/expenses/transactions", expense, keyed("key-spend-0001"));
        const second = await client.post("/expenses/transactions", expense, keyed("key-spend-0001"));
        assert.deepEqual([first.status, second.status], [201, 201]);
        assert.equal(first.body.transaction._id, second.body.transaction._id);
        assert.equal(await ExpenseTransaction.countDocuments({ user: user._id }), 1);
        assert.equal((await KnownSpendPlace.findOne({ user: user._id })).transactionCount, 1);

        const subscription = { name: "Rent", amount: 9000, accountId: account._id };
        const [one, two] = [
            await client.post("/expenses/subscriptions", subscription, keyed("key-sub-000001")),
            await client.post("/expenses/subscriptions", subscription, keyed("key-sub-000001")),
        ];
        assert.equal(one.body.subscription._id, two.body.subscription._id);
        assert.equal(await ExpenseSubscription.countDocuments({ user: user._id }), 1);
    });

    it("makes one when both arrive at the same moment", async () => {
        const { client, user, keyed } = await setup();

        const answers = await Promise.all(
            [1, 2, 3, 4].map(() => client.post("/todos", { title: "At once" }, keyed("key-race-00001"))),
        );
        assert.ok(answers.every((answer) => answer.status === 201));
        assert.equal(new Set(answers.map((answer) => answer.body.todo._id)).size, 1);
        assert.equal(await Todo.countDocuments({ user: user._id }), 1);
    });

    it("still makes two for two keys, for no key, and for the same key on two accounts", async () => {
        const { client, user, keyed } = await setup();
        const other = await setup();

        await client.post("/todos", { title: "Same words" }, keyed("key-first-0001"));
        await client.post("/todos", { title: "Same words" }, keyed("key-second-001"));
        await client.post("/todos", { title: "Same words" });
        await client.post("/todos", { title: "Same words" });
        // Not a key: too short to be one, so it is left aside
        await client.post("/todos", { title: "Same words" }, keyed("short"));
        await client.post("/todos", { title: "Same words" }, keyed("short"));
        assert.equal(await Todo.countDocuments({ user: user._id }), 6);

        const theirs = await other.client.post("/todos", { title: "Same words" }, other.keyed("key-first-0001"));
        assert.equal(theirs.status, 201);
        assert.equal(await Todo.countDocuments({ user: other.user._id }), 1);
    });
});
