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
import Todo from "../../src/models/Todo.js";
import Goal from "../../src/models/Goal.js";
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import Routine from "../../src/models/Routine.js";
import RoutineLog from "../../src/models/RoutineLog.js";
import WeekPlan from "../../src/models/WeekPlan.js";
import XPLog from "../../src/models/XPLog.js";
import eraseAccount from "../../src/utils/eraseAccount.js";

// Week: to-dos planned for a day (and a time), a week's focus, notes and review, and how each routine and
// habit stood on each day, for the week's tracker. None of it earns or costs XP.

const TIMEZONE = "Asia/Kolkata";
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("the week planner", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const setup = async () => {
        const client = createClient({ timezone: TIMEZONE });
        const { email } = await client.register();
        const user = await User.findOne({ email });
        const today = todayIn(TIMEZONE);

        return {
            client,
            user,
            today,
            add: (body) => client.post("/todos", { title: "Call the plumber", ...body }),
            change: (id, body) => client.put(`/todos/${id}`, body),
            general: async () => (await client.get("/todos")).body.lists[0],
        };
    };

    describe("a planned to-do", () => {
        it("can be given a day, a time and an end, and is listed with them", async () => {
            const { add, general, today } = await setup();

            const made = await add({ date: today, time: "15:00", endTime: "15:30" });
            assert.equal(made.status, 201);
            assert.equal(made.body.todo.date, today);
            assert.equal(made.body.todo.time, "15:00");
            assert.equal(made.body.todo.endTime, "15:30");

            const plain = (await add({ title: "Someday" })).body.todo;
            assert.equal(plain.date, null);
            assert.equal(plain.time, null);

            const titles = (await general()).todos.map((todo) => [todo.title, todo.date]);
            assert.deepEqual(titles, [
                ["Call the plumber", today],
                ["Someday", null],
            ]);
        });

        it("cannot be planned for a day that has passed, nor have a time without a day or an end before its start", async () => {
            const { add, today } = await setup();

            assert.equal((await add({ date: addDays(today, -1) })).status, 400);
            assert.equal((await add({ time: "09:00" })).status, 400);
            assert.equal((await add({ date: today, endTime: "10:00" })).status, 400);
            assert.equal((await add({ date: today, time: "10:00", endTime: "09:30" })).status, 400);
            assert.equal((await add({ date: today, time: "10:00", endTime: "10:00" })).status, 400);
            assert.equal((await add({ date: today, time: "9:00" })).status, 400);
            assert.equal((await add({ date: "2026-02-30" })).status, 400);
        });

        it("moves between days, loses its time with its day, and keeps a day that has since passed", async () => {
            const { add, change, user, today } = await setup();
            const todo = (await add({ date: today, time: "09:00", endTime: "10:00" })).body.todo;

            // Onto tomorrow, the time kept
            let moved = await change(todo._id, { date: addDays(today, 1) });
            assert.equal(moved.status, 200);
            assert.equal(moved.body.todo.time, "09:00");
            assert.equal(moved.body.todo.endTime, "10:00");

            // The start taken away takes the end
            moved = await change(todo._id, { time: null });
            assert.equal(moved.body.todo.time, null);
            assert.equal(moved.body.todo.endTime, null);

            // Back to no day at all
            moved = await change(todo._id, { time: "08:00" });
            moved = await change(todo._id, { date: null });
            assert.equal(moved.body.todo.date, null);
            assert.equal(moved.body.todo.time, null);

            // Not into the past
            assert.equal((await change(todo._id, { date: addDays(today, -2) })).status, 400);

            // One planned for a day that has since gone can still be ticked, renamed and moved on
            await Todo.updateOne({ _id: todo._id }, { date: addDays(today, -3) });
            assert.equal((await change(todo._id, { done: true, title: "Plumber, done" })).status, 200);
            assert.equal((await change(todo._id, { done: false })).status, 200);
            const onward = await change(todo._id, { date: today });
            assert.equal(onward.status, 200);
            assert.equal(onward.body.todo.date, today);
            assert.equal((await Todo.findById(todo._id)).user.toString(), user._id.toString());
        });

        it("stays on the lists while open, and for six weeks once finished; earlier weeks are read by range", async () => {
            const { client, add, user, today, general } = await setup();
            const list = (await general())._id;
            const at = (date, done) => Todo.create({ user: user._id, list, title: `${date} ${done}`, date, done });

            await at(addDays(today, -60), false);
            await at(addDays(today, -60), true);
            await at(addDays(today, -41), true);
            await at(addDays(today, -42), true);
            await add({ title: "Plain" });

            const shown = (await general()).todos.map((todo) => todo.title).sort();
            assert.deepEqual(shown, [`${addDays(today, -41)} true`, `${addDays(today, -60)} false`, "Plain"].sort());

            const planned = await client.get(`/todos/planned?from=${addDays(today, -62)}&to=${addDays(today, -55)}`);
            assert.equal(planned.status, 200);
            assert.deepEqual(
                planned.body.todos.map((todo) => todo.done).sort(),
                [false, true],
            );
            assert.equal((await client.get("/todos/planned?from=2026-10-10")).status, 400);
            assert.equal((await createClient().get(`/todos/planned?from=${today}&to=${today}`)).status, 401);
        });

        it("does not fill a list once it is finished", async () => {
            const { add, user, today, general } = await setup();
            const list = (await general())._id;

            await Todo.insertMany(
                Array.from({ length: 500 }, (_, index) => ({
                    user: user._id,
                    list,
                    title: `Done ${index}`,
                    date: addDays(today, -1),
                    done: true,
                })),
            );
            assert.equal((await add({ title: "Still room" })).status, 201);
        });
    });

    describe("a week's focus, notes and review", () => {
        it("is empty until written, then kept under the week's first day", async () => {
            const { client, user } = await setup();
            const start = "2026-10-11";

            const empty = await client.get(`/weeks/${start}`);
            assert.equal(empty.status, 200);
            assert.deepEqual(empty.body.week, { start, focus: [], notes: "", wentWell: "", better: "" });
            assert.equal(await WeekPlan.countDocuments({ user: user._id }), 0);

            const written = await client.put(`/weeks/${start}`, {
                focus: [{ title: "Finish the chapter" }, { title: "Two long runs", done: true }],
                notes: "Dentist on Thursday.",
            });
            assert.equal(written.status, 200);
            assert.deepEqual(
                written.body.week.focus.map((entry) => [entry.title, entry.done]),
                [
                    ["Finish the chapter", false],
                    ["Two long runs", true],
                ],
            );

            // Each field sent replaces what was there; a field left out is kept
            const first = written.body.week.focus[0];
            const again = await client.put(`/weeks/${start}`, {
                focus: [{ _id: first._id, title: first.title, done: true }],
                wentWell: "Kept the mornings.",
            });
            assert.equal(again.body.week.focus.length, 1);
            assert.equal(again.body.week.focus[0]._id, first._id);
            assert.equal(again.body.week.notes, "Dentist on Thursday.");
            assert.equal(again.body.week.wentWell, "Kept the mornings.");
            assert.equal(await WeekPlan.countDocuments({ user: user._id }), 1);

            const read = (await client.get(`/weeks/${start}`)).body.week;
            assert.equal(read.focus[0].done, true);
        });

        it("is made once when two first writes arrive together", async () => {
            const { client, user } = await setup();
            const answers = await Promise.all([
                client.put("/weeks/2026-10-18", { notes: "A" }),
                client.put("/weeks/2026-10-18", { better: "B" }),
            ]);
            assert.ok(answers.every((answer) => answer.status === 200));
            assert.equal(await WeekPlan.countDocuments({ user: user._id, start: "2026-10-18" }), 1);
        });

        it("links a focus to the account's own goals only, and checks what it is sent", async () => {
            const { client, user } = await setup();
            const other = await setup();
            const mine = await Goal.create({ user: user._id, title: "Run a half marathon" });
            const theirs = await Goal.create({ user: other.user._id, title: "Theirs" });

            const linked = await client.put("/weeks/2026-10-11", { focus: [{ title: "Long run", goalId: mine._id }] });
            assert.equal(linked.status, 200);
            assert.equal(linked.body.week.focus[0].goal, mine._id.toString());

            assert.equal(
                (await client.put("/weeks/2026-10-11", { focus: [{ title: "Sneaky", goalId: theirs._id }] })).status,
                404,
            );
            assert.equal((await client.put("/weeks/2026-10-11", {})).status, 400);
            assert.equal((await client.put("/weeks/2026-10-11", { focus: [{ title: "" }] })).status, 400);
            assert.equal(
                (await client.put("/weeks/2026-10-11", { focus: Array.from({ length: 6 }, (_, i) => ({ title: `F${i}` })) })).status,
                400,
            );
            assert.equal((await client.put("/weeks/not-a-day", { notes: "x" })).status, 400);
            // An owner sent along is not taken: the week stays this account's
            assert.equal((await client.put("/weeks/2026-10-11", { user: other.user._id, notes: "x" })).status, 200);
            assert.equal(await WeekPlan.countDocuments({ user: other.user._id }), 0);

            // Another account sees nothing of it
            const theirWeek = (await other.client.get("/weeks/2026-10-11")).body.week;
            assert.deepEqual(theirWeek.focus, []);
            assert.equal(theirWeek.notes, "");
        });

        it("goes with the account when the account is erased", async () => {
            const { client, user } = await setup();
            await client.put("/weeks/2026-10-11", { notes: "Gone soon" });

            await eraseAccount(user._id);
            assert.equal(await WeekPlan.countDocuments({ user: user._id }), 0);
        });
    });

    describe("the week's marks", () => {
        it("says how each routine and habit stood on each day it has a record for", async () => {
            const { client, user, today } = await setup();
            const yesterday = addDays(today, -1);
            const before = addDays(today, -2);

            const routine = await Routine.create({ user: user._id, title: "Run", startTime: "06:00", endTime: "07:00", isRecurring: true, recurringDays: EVERY_DAY });
            const habit = await Habit.create({ user: user._id, title: "Read", habitType: "quantity", targetQuantity: 20, unit: "pages" });

            await RoutineLog.create({ routine: routine._id, user: user._id, date: before, completedAt: "06:30", wasOnTime: true, xpEarned: 10 });
            await RoutineLog.create({ routine: routine._id, user: user._id, date: today, completedAt: "07:30", wasOnTime: false, xpEarned: 5 });
            await XPLog.create({ user: user._id, amount: -5, reason: "routine_missed", metadata: { routineId: routine._id, date: yesterday } });
            await HabitLog.create({ habit: habit._id, user: user._id, date: before, quantity: 20, completed: true });
            await HabitLog.create({ habit: habit._id, user: user._id, date: yesterday, quantity: 8, completed: false });
            // Partly done and charged for it: the record of what was done is what is shown
            await XPLog.create({ user: user._id, amount: -5, reason: "habit_missed", metadata: { habitId: habit._id.toString(), date: yesterday } });

            const response = await client.get(`/history/marks?from=${before}&to=${today}`);
            assert.equal(response.status, 200);
            assert.equal(response.body.today, today);

            const seen = response.body.marks.map((mark) => [mark.date, mark.kind, mark.status, mark.quantity ?? null]);
            assert.deepEqual(
                seen.sort(),
                [
                    [before, "habit", "done", null],
                    [before, "routine", "done", null],
                    [today, "routine", "late", null],
                    [yesterday, "habit", "partial", 8],
                    [yesterday, "routine", "missed", null],
                ].sort(),
            );

            // Nobody else's
            const other = await setup();
            assert.deepEqual((await other.client.get(`/history/marks?from=${before}&to=${today}`)).body.marks, []);
            assert.equal((await client.get(`/history/marks?from=${today}&to=${before}`)).status, 400);
        });
    });
});
