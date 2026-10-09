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
import Goal from "../../src/models/Goal.js";

// Goals: something to reach, with milestones to tick off and the routines and habits that carry it.

const TZ = "Asia/Kolkata";

describe("goals", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);

    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        await client.register();

        return {
            client,
            goals: async () => (await client.get("/goals")).body.goals,
            set: async (fields = {}) => (await client.post("/goals", { title: "Goal", ...fields })).body.goal,
            routine: async (fields = {}) =>
                (await client.post("/routines", { title: "Routine", startTime: "07:00", isRecurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6], ...fields })).body,
            habit: async (fields = {}) => (await client.post("/habits", { title: "Habit", ...fields })).body.habit,
        };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        const id = "a".repeat(24);

        assert.equal((await stranger.get("/goals")).status, 401);
        assert.equal((await stranger.post("/goals", { title: "Nope" })).status, 401);
        assert.equal((await stranger.put(`/goals/${id}`, { title: "Nope" })).status, 401);
        assert.equal((await stranger.put(`/goals/${id}/milestones/${id}`, { done: true })).status, 401);
        assert.equal((await stranger.delete(`/goals/${id}`)).status, 401);
    });

    describe("setting one", () => {
        it("takes a name alone, and says what day it is", async () => {
            const { client, set } = await setup();

            const goal = await set({ title: "  Run ten kilometres  " });
            assert.equal(goal.title, "Run ten kilometres");
            assert.deepEqual(
                [goal.note, goal.targetDate, goal.reachedAt, goal.milestones, goal.links],
                ["", null, null, [], []],
            );

            const answer = (await client.get("/goals")).body;
            assert.equal(answer.today, today);
            assert.deepEqual(answer.goals.map((entry) => entry._id), [goal._id]);
        });

        it("takes a date, a note, milestones in order, and the routines and habits that carry it", async () => {
            const { set, routine, habit } = await setup();
            const run = await routine({ title: "Morning run" });
            const stretch = await habit({ title: "Stretch" });

            const goal = await set({
                title: "Run ten kilometres",
                note: "By the spring race",
                targetDate: addDays(today, 60),
                milestones: [{ title: "Three" }, { title: "Five", done: true }, { title: "Eight" }],
                links: [{ kind: "routine", id: run._id }, { kind: "habit", id: stretch._id }],
            });

            assert.equal(goal.targetDate, addDays(today, 60));
            assert.deepEqual(goal.milestones.map((milestone) => [milestone.title, milestone.done, Boolean(milestone.doneAt)]), [
                ["Three", false, false],
                ["Five", true, true],
                ["Eight", false, false],
            ]);
            assert.deepEqual(goal.links, [
                { kind: "routine", id: run._id, title: "Morning run", active: true },
                { kind: "habit", id: stretch._id, title: "Stretch", active: true },
            ]);
        });

        it("refuses what is not a goal", async () => {
            const { client, routine } = await setup();
            const run = await routine();

            for (const body of [
                {},
                { title: "" },
                { title: "x".repeat(121) },
                { title: "Fine", targetDate: "2026-02-30" },
                { title: "Fine", targetDate: "soon" },
                { title: "Fine", note: "x".repeat(501) },
                { title: "Fine", milestones: [{ title: "" }] },
                { title: "Fine", milestones: Array.from({ length: 31 }, (_, index) => ({ title: `Step ${index}` })) },
                { title: "Fine", links: [{ kind: "expense", id: run._id }] },
                { title: "Fine", links: [{ kind: "routine", id: "nope" }] },
                { title: "Fine", links: [{ kind: "routine", id: run._id }, { kind: "routine", id: run._id }] },
            ]) {
                assert.equal((await client.post("/goals", body)).status, 400, JSON.stringify(body).slice(0, 80));
            }
        });

        it("cannot be carried by someone else's routine, or by one that is not there", async () => {
            const { client, routine } = await setup();
            const other = await setup();
            const theirs = await other.routine();
            const mine = await routine();
            // A habit's id offered as a routine names nothing either
            const habit = (await client.post("/habits", { title: "Habit" })).body.habit;

            for (const links of [
                [{ kind: "routine", id: theirs._id }],
                [{ kind: "routine", id: "a".repeat(24) }],
                [{ kind: "routine", id: habit._id }],
                [{ kind: "routine", id: mine._id }, { kind: "habit", id: theirs._id }],
            ]) {
                assert.equal((await client.post("/goals", { title: "Goal", links })).status, 404);
            }
            assert.equal((await client.get("/goals")).body.goals.length, 0);
        });

        it("ignores an owner, dates and a reached mark sent by the client", async () => {
            const { client } = await setup();
            const other = await setup();
            const otherId = (await other.client.get("/auth/me")).body.user._id;

            const response = await client.post("/goals", { title: "Mine", user: otherId, reachedAt: "2020-01-01", deletedAt: "2020-01-01", createdAt: "2020-01-01" });
            assert.equal(response.status, 201);

            const saved = await Goal.findById(response.body.goal._id);
            assert.notEqual(saved.user.toString(), otherId);
            assert.deepEqual([saved.reachedAt, saved.deletedAt], [null, null]);
            assert.ok(saved.createdAt.getFullYear() > 2020);
        });
    });

    describe("its milestones", () => {
        it("are ticked one at a time, and the same tick twice changes nothing", async () => {
            const { client, set } = await setup();
            const goal = await set({ milestones: [{ title: "First" }, { title: "Second" }] });
            const [first] = goal.milestones;

            const ticked = await client.put(`/goals/${goal._id}/milestones/${first.id}`, { done: true });
            assert.equal(ticked.status, 200);
            const doneAt = ticked.body.goal.milestones[0].doneAt;
            assert.ok(doneAt);
            assert.equal(ticked.body.goal.milestones[1].done, false);

            const again = await client.put(`/goals/${goal._id}/milestones/${first.id}`, { done: true });
            assert.equal(again.body.goal.milestones[0].doneAt, doneAt);

            const unticked = await client.put(`/goals/${goal._id}/milestones/${first.id}`, { done: false });
            assert.deepEqual([unticked.body.goal.milestones[0].done, unticked.body.goal.milestones[0].doneAt], [false, null]);
        });

        it("keep what was ticked when the list is edited: reworded, reordered, added to and removed from", async () => {
            const { client, set } = await setup();
            const goal = await set({ milestones: [{ title: "One", done: true }, { title: "Two" }, { title: "Three" }] });
            const [one, two] = goal.milestones;

            const edited = await client.put(`/goals/${goal._id}`, {
                milestones: [{ title: "Zero" }, { id: two.id, title: "Two, reworded" }, { id: one.id, title: "One" }],
            });
            assert.equal(edited.status, 200);

            const now = edited.body.goal.milestones;
            assert.deepEqual(now.map((milestone) => [milestone.title, milestone.done]), [
                ["Zero", false],
                ["Two, reworded", false],
                ["One", true],
            ]);
            assert.equal(now[2].id, one.id);
            assert.equal(now[2].doneAt, one.doneAt);
            assert.equal(now[1].id, two.id);
        });

        it("cannot be ticked on someone else's goal, or when it is not one of the goal's", async () => {
            const { client, set } = await setup();
            const other = await setup();
            const goal = await set({ milestones: [{ title: "Mine" }] });
            const [mine] = goal.milestones;

            assert.equal((await other.client.put(`/goals/${goal._id}/milestones/${mine.id}`, { done: true })).status, 404);
            assert.equal((await client.put(`/goals/${goal._id}/milestones/${"a".repeat(24)}`, { done: true })).status, 404);
            assert.equal((await client.put(`/goals/${goal._id}/milestones/${mine.id}`, {})).status, 400);
            assert.equal((await Goal.findById(goal._id)).milestones[0].done, false);
        });
    });

    describe("changing one", () => {
        it("changes what is sent and leaves the rest", async () => {
            const { client, set, routine } = await setup();
            const run = await routine({ title: "Morning run" });
            const goal = await set({ title: "Run", note: "Slowly", targetDate: addDays(today, 30), links: [{ kind: "routine", id: run._id }] });

            const renamed = (await client.put(`/goals/${goal._id}`, { title: "Run further" })).body.goal;
            assert.deepEqual(
                [renamed.title, renamed.note, renamed.targetDate, renamed.links.length],
                ["Run further", "Slowly", addDays(today, 30), 1],
            );

            const undated = (await client.put(`/goals/${goal._id}`, { targetDate: null, note: "", links: [] })).body.goal;
            assert.deepEqual([undated.targetDate, undated.note, undated.links], [null, "", []]);

            assert.equal((await client.put(`/goals/${goal._id}`, {})).status, 400);
            assert.equal((await client.put(`/goals/${"a".repeat(24)}`, { title: "Nobody's" })).status, 404);
        });

        it("is marked as reached, and can be opened again", async () => {
            const { client, set } = await setup();
            const goal = await set();

            const reached = (await client.put(`/goals/${goal._id}`, { reached: true })).body.goal;
            assert.ok(reached.reachedAt);

            const still = (await client.put(`/goals/${goal._id}`, { reached: true })).body.goal;
            assert.equal(still.reachedAt, reached.reachedAt);

            const open = (await client.put(`/goals/${goal._id}`, { reached: false })).body.goal;
            assert.equal(open.reachedAt, null);
        });

        it("keeps a link to something since deleted, shown as out of the plan, and takes no new link to it", async () => {
            const { client, set, routine, habit } = await setup();
            const run = await routine({ title: "Morning run" });
            const stretch = await habit({ title: "Stretch" });
            const goal = await set({ links: [{ kind: "routine", id: run._id }] });
            await client.delete(`/routines/${run._id}`);
            await client.delete(`/habits/${stretch._id}`);

            const [listed] = (await client.get("/goals")).body.goals;
            assert.deepEqual(listed.links, [{ kind: "routine", id: run._id, title: "Morning run", active: false }]);

            // Saving the goal with the link it already has is fine
            assert.equal((await client.put(`/goals/${goal._id}`, { title: "Renamed", links: [{ kind: "routine", id: run._id }] })).status, 200);
            // Adding a link to something in Trash is not
            assert.equal((await client.put(`/goals/${goal._id}`, { links: [{ kind: "habit", id: stretch._id }] })).status, 404);
        });
    });

    describe("the list", () => {
        it("puts open goals first, the soonest date first, those without a date after, then the ones reached", async () => {
            const { client, set, goals } = await setup();
            await set({ title: "No date" });
            await set({ title: "Later", targetDate: addDays(today, 90) });
            const reached = await set({ title: "Reached", targetDate: addDays(today, 1) });
            await set({ title: "Sooner", targetDate: addDays(today, 10) });
            await client.put(`/goals/${reached._id}`, { reached: true });

            assert.deepEqual((await goals()).map((goal) => goal.title), ["Sooner", "Later", "No date", "Reached"]);
        });

        it("holds only the user's own", async () => {
            const { set, goals } = await setup();
            const other = await setup();
            await set({ title: "Mine" });
            await other.set({ title: "Theirs" });

            assert.deepEqual((await goals()).map((goal) => goal.title), ["Mine"]);
        });
    });

    describe("deleting one", () => {
        it("puts it in Trash and brings it back with its milestones and links", async () => {
            const { client, set, goals, routine } = await setup();
            const run = await routine({ title: "Morning run" });
            const goal = await set({ title: "Run", targetDate: addDays(today, 30), milestones: [{ title: "Five", done: true }], links: [{ kind: "routine", id: run._id }] });

            const deleted = await client.delete(`/goals/${goal._id}`);
            assert.equal(deleted.status, 200);
            assert.deepEqual(await goals(), []);
            assert.equal((await client.put(`/goals/${goal._id}`, { title: "Nope" })).status, 404);
            assert.equal((await client.put(`/goals/${goal._id}/milestones/${goal.milestones[0].id}`, { done: false })).status, 404);

            const [held] = (await client.get("/trash")).body.items;
            assert.deepEqual([held.kind, held.id, held.title, held.targetDate, held.milestones], ["goal", goal._id, "Run", addDays(today, 30), 1]);

            assert.equal((await client.post(`/trash/goal/${goal._id}/restore`)).status, 200);
            const [back] = await goals();
            assert.deepEqual(back, goal);
        });

        it("is the owner's alone to do", async () => {
            const { set } = await setup();
            const other = await setup();
            const goal = await set();

            assert.equal((await other.client.delete(`/goals/${goal._id}`)).status, 404);
            assert.equal((await Goal.findById(goal._id)).deletedAt, null);
        });
    });
});
