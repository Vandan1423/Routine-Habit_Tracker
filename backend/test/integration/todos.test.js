import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import TodoList from "../../src/models/TodoList.js";
import Todo from "../../src/models/Todo.js";
import DailyLog from "../../src/models/DailyLog.js";

// To-do lists: a general list every account has, and named ones. A to-do has no day, no XP and no penalty.

describe("to-do lists", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient();
        const { email } = await client.register();
        const user = await User.findOne({ email });

        return {
            client,
            user,
            lists: async () => (await client.get("/todos")).body.lists,
            add: async (title, listId) => (await client.post("/todos", { title, ...(listId ? { listId } : {}) })).body.todo,
            list: async (name) => (await client.post("/todos/lists", { name })).body.list,
            titles: (list) => list.todos.map((todo) => todo.title),
            trash: async () => (await client.get("/trash")).body.items,
            restore: (kind, id) => client.post(`/trash/${kind}/${id}/restore`),
        };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        const id = "a".repeat(24);

        assert.equal((await stranger.get("/todos")).status, 401);
        assert.equal((await stranger.post("/todos", { title: "Nope" })).status, 401);
        assert.equal((await stranger.put(`/todos/${id}`, { done: true })).status, 401);
        assert.equal((await stranger.delete(`/todos/lists/${id}`)).status, 401);
    });

    describe("the general list", () => {
        it("is there from the start, once, however often it is asked for", async () => {
            const { client, user, lists } = await setup();

            const answers = await Promise.all([client.get("/todos"), client.get("/todos"), client.get("/todos")]);
            assert.ok(answers.every((answer) => answer.status === 200));
            assert.equal(await TodoList.countDocuments({ user: user._id }), 1);

            const [general] = await lists();
            assert.equal(general.isDefault, true);
            assert.deepEqual(general.todos, []);
        });

        it("takes a to-do that names no list", async () => {
            const { add, lists, titles } = await setup();

            const todo = await add("  Renew the passport  ");
            assert.equal(todo.title, "Renew the passport");
            assert.equal(todo.done, false);

            const [general] = await lists();
            assert.deepEqual(titles(general), ["Renew the passport"]);
        });

        it("cannot be renamed or deleted", async () => {
            const { client, lists } = await setup();
            const [general] = await lists();

            assert.equal((await client.put(`/todos/lists/${general._id}`, { name: "Mine" })).status, 400);
            assert.equal((await client.delete(`/todos/lists/${general._id}`)).status, 400);
            assert.equal((await lists()).length, 1);
        });
    });

    describe("named lists", () => {
        it("are listed after the general one, in the order they were made, each with its to-dos oldest first", async () => {
            const { add, list, lists, titles } = await setup();
            const groceries = await list("Groceries");
            const trip = await list("Trip");

            await add("Rice", groceries._id);
            await add("Book the train", trip._id);
            await add("Call the plumber");
            await add("Curd", groceries._id);

            const all = await lists();
            assert.deepEqual(all.map((entry) => entry.name), ["To-do", "Groceries", "Trip"]);
            assert.deepEqual(all.map(titles), [["Call the plumber"], ["Rice", "Curd"], ["Book the train"]]);
        });

        it("can be renamed", async () => {
            const { client, list, lists } = await setup();
            const made = await list("Grocries");

            const renamed = await client.put(`/todos/lists/${made._id}`, { name: "Groceries" });
            assert.equal(renamed.status, 200);
            assert.deepEqual((await lists()).map((entry) => entry.name), ["To-do", "Groceries"]);
        });

        it("refuse a name that is empty or too long", async () => {
            const { client } = await setup();

            for (const name of ["", "  ", "x".repeat(61), 7, null]) {
                assert.equal((await client.post("/todos/lists", { name })).status, 400, JSON.stringify(name));
            }
            assert.equal((await client.post("/todos/lists", {})).status, 400);
        });
    });

    describe("a to-do", () => {
        it("is ticked and un-ticked, and that touches neither XP nor the day", async () => {
            const { client, user, add } = await setup();
            const todo = await add("Pay the electricity bill");

            const ticked = await client.put(`/todos/${todo._id}`, { done: true });
            assert.equal(ticked.status, 200);
            assert.equal(ticked.body.todo.done, true);
            assert.ok(ticked.body.todo.doneAt);

            const unticked = await client.put(`/todos/${todo._id}`, { done: false });
            assert.equal(unticked.body.todo.done, false);
            assert.equal(unticked.body.todo.doneAt, null);

            assert.equal((await client.get("/gamification/stats")).body.totalXp, 0);
            assert.equal(await DailyLog.countDocuments({ user: user._id }), 0);
        });

        it("can be reworded and moved to another list", async () => {
            const { client, add, list, lists, titles } = await setup();
            const groceries = await list("Groceries");
            const todo = await add("Milk");

            const moved = await client.put(`/todos/${todo._id}`, { title: "Oat milk", listId: groceries._id });
            assert.equal(moved.status, 200);

            const [general, named] = await lists();
            assert.deepEqual(titles(general), []);
            assert.deepEqual(titles(named), ["Oat milk"]);
        });

        it("cannot be put on a list that is someone else's, missing or in Trash", async () => {
            const { client, add, list } = await setup();
            const other = await setup();
            const theirs = await other.list("Theirs");
            const gone = await list("Gone");
            await client.delete(`/todos/lists/${gone._id}`);
            const todo = await add("Mine");

            for (const listId of [theirs._id, gone._id, "a".repeat(24)]) {
                assert.equal((await client.post("/todos", { title: "Nope", listId })).status, 404);
                assert.equal((await client.put(`/todos/${todo._id}`, { listId })).status, 404);
            }
        });

        it("is out of reach of anyone but its owner", async () => {
            const { add } = await setup();
            const other = await setup();
            const todo = await add("Mine");

            assert.equal((await other.client.put(`/todos/${todo._id}`, { done: true })).status, 404);
            assert.equal((await other.client.delete(`/todos/${todo._id}`)).status, 404);
            assert.equal((await Todo.findById(todo._id)).done, false);
        });

        it("refuses words that are empty or too long, and a change that changes nothing", async () => {
            const { client, add } = await setup();
            const todo = await add("Fine");

            for (const title of ["", "   ", "x".repeat(201), 3]) {
                assert.equal((await client.post("/todos", { title })).status, 400, JSON.stringify(title));
                assert.equal((await client.put(`/todos/${todo._id}`, { title })).status, 400, JSON.stringify(title));
            }
            assert.equal((await client.put(`/todos/${todo._id}`, {})).status, 400);
            assert.equal((await client.put(`/todos/${todo._id}`, { done: "yes please" })).status, 400);
        });
    });

    describe("deleting", () => {
        it("puts a to-do in Trash and brings it back to its list as it was", async () => {
            const { client, add, list, lists, titles, trash, restore } = await setup();
            const groceries = await list("Groceries");
            const todo = await add("Rice", groceries._id);
            await client.put(`/todos/${todo._id}`, { done: true });

            const deleted = await client.delete(`/todos/${todo._id}`);
            assert.equal(deleted.status, 200);
            assert.ok(deleted.body.purgeAt);
            assert.deepEqual(titles((await lists())[1]), []);

            const [held] = await trash();
            assert.deepEqual([held.kind, held.id, held.title, held.done], ["todo", todo._id, "Rice", true]);
            assert.deepEqual(held.list, { name: "Groceries", isDefault: false });

            assert.equal((await restore("todo", todo._id)).status, 200);
            const [back] = (await lists())[1].todos;
            assert.deepEqual([back._id, back.title, back.done], [todo._id, "Rice", true]);
        });

        it("puts a list in Trash with everything on it, as one entry, and brings all of it back", async () => {
            const { client, add, list, lists, titles, trash, restore } = await setup();
            const groceries = await list("Groceries");
            await add("Rice", groceries._id);
            const curd = await add("Curd", groceries._id);
            const soap = await add("Soap", groceries._id);
            // One was already in Trash by itself before the list went
            await client.delete(`/todos/${soap._id}`);

            const deleted = await client.delete(`/todos/lists/${groceries._id}`);
            assert.equal(deleted.status, 200);
            assert.equal(deleted.body.todos, 2);
            assert.deepEqual((await lists()).map((entry) => entry.name), ["To-do"]);

            const held = await trash();
            assert.deepEqual(
                held.map((item) => [item.kind, item.title]).sort(),
                [["todo", "Soap"], ["todoList", "Groceries"]],
            );
            assert.equal(held.find((item) => item.kind === "todoList").todos, 2);

            // Nothing on it can be reached while the list is in Trash
            assert.equal((await client.put(`/todos/${curd._id}`, { done: true })).status, 404);
            assert.equal((await restore("todo", curd._id)).status, 404);
            // And the one deleted by itself waits for its list
            const refused = await restore("todo", soap._id);
            assert.equal(refused.status, 409);
            assert.match(refused.body.message, /list/);

            assert.equal((await restore("todoList", groceries._id)).status, 200);
            const [, back] = await lists();
            assert.equal(back._id, groceries._id);
            assert.deepEqual(titles(back), ["Rice", "Curd"]);

            assert.equal((await restore("todo", soap._id)).status, 200);
            assert.deepEqual(titles((await lists())[1]), ["Rice", "Curd", "Soap"]);
        });

        it("clears the finished to-dos of a list into Trash, and leaves the rest", async () => {
            const { client, add, lists, titles, trash, restore } = await setup();
            const [general] = await lists();
            const done = [await add("One"), await add("Two")];
            await add("Three");
            for (const todo of done) await client.put(`/todos/${todo._id}`, { done: true });

            const cleared = await client.post(`/todos/lists/${general._id}/clear`);
            assert.equal(cleared.status, 200);
            assert.deepEqual(cleared.body.ids.sort(), done.map((todo) => todo._id).sort());
            assert.deepEqual(titles((await lists())[0]), ["Three"]);
            assert.equal((await trash()).length, 2);

            // Each comes back by itself
            await restore("todo", done[0]._id);
            assert.deepEqual(titles((await lists())[0]), ["One", "Three"]);
        });

        it("lets go of a list for good with what went in with it; a to-do deleted by itself then lands on the general list", async () => {
            const { client, user, add, list, lists, titles, trash, restore } = await setup();
            const groceries = await list("Groceries");
            await add("Rice", groceries._id);
            const soap = await add("Soap", groceries._id);
            await client.delete(`/todos/${soap._id}`);
            await client.delete(`/todos/lists/${groceries._id}`);

            assert.equal((await client.delete(`/trash/todoList/${groceries._id}`)).status, 200);
            assert.equal(await TodoList.countDocuments({ _id: groceries._id }), 0);
            assert.equal(await Todo.countDocuments({ user: user._id, title: "Rice" }), 0);
            assert.deepEqual((await trash()).map((item) => item.title), ["Soap"]);

            assert.equal((await restore("todo", soap._id)).status, 200);
            assert.deepEqual(titles((await lists())[0]), ["Soap"]);
        });
    });
});
