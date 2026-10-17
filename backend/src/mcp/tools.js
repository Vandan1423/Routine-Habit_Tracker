import * as z from "zod";

import Routine from "../models/Routine.js";
import Habit from "../models/Habit.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import { TRASH_KINDS } from "../utils/trashKinds.js";
import { MOST_FOCUS } from "../Schema/WeekSchema.js";
import { MOST_LINKS, MOST_MILESTONES } from "../Schema/GoalSchema.js";
import { CATEGORIES as EXPENSE_CATEGORIES } from "../controllers/expenseController.js";

// What Claude can do in a person's account: everything they can do in the app, except account and security
// actions (deleting the account, changing the password, emptying Trash or erasing from it).
//
// Each tool is a thin layer over the app's own API: it names a request and callApp sends it through the app as
// the person, so the app's rules decide every case and its messages come back as they are. The schemas below
// describe each request for Claude; the app's own Joi schemas (src/Schema) still have the last word.

// ── Building blocks ──

const enumOf = (model, path) => z.enum(model.schema.path(path).enumValues);

const id = (what) => z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid id.").describe(`The ${what}'s id`);
const day = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "A day is written YYYY-MM-DD.")
    .describe("A day, YYYY-MM-DD, in the person's own timezone");
const clock = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time is written HH:MM on a 24-hour clock.")
    .describe("A time of day, HH:MM on a 24-hour clock");
const month = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is written YYYY-MM.")
    .describe("A month, YYYY-MM. Left out, the month today is in.");
const weekdays = z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .describe("Days of the week: 0 is Sunday, 1 Monday … 6 Saturday");
const itemKind = z.enum(["routine", "habit"]).describe("Whether it is a routine or a habit");
const amount = z.number().positive().max(1e12);
const isoDate = z.string().describe("A date (YYYY-MM-DD) or a date and time in ISO 8601");
const expenseCategory = z.enum(EXPENSE_CATEGORIES).describe("What it is for, from the app's own list");

// ── Fields of each kind of thing, as the app's API takes them ──

const routineFields = {
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional(),
    startTime: clock.describe("When it starts, HH:MM (24-hour)"),
    endTime: z
        .union([clock, z.literal("")])
        .optional()
        .describe(
            "When it ends, HH:MM. Done more than 15 minutes after this, it pays half its XP. Empty or left out: no end, so it can't be late.",
        ),
    category: enumOf(Routine, "category").optional(),
    isRecurring: z
        .boolean()
        .optional()
        .describe("true: it repeats on recurringDays. false: it happens once, on date."),
    recurringDays: weekdays.optional().describe("For a repeating routine: the days of the week it is on (0 = Sunday)"),
    date: day.nullable().optional().describe("For a one-off routine: the day it is on, YYYY-MM-DD"),
};

const habitFields = {
    title: z.string().trim().min(1).max(120),
    description: z.string().max(500).optional(),
    category: enumOf(Habit, "category").optional(),
    frequency: enumOf(Habit, "frequency")
        .optional()
        .describe("daily: every day. weekly: only on targetDays."),
    targetDays: weekdays.optional().describe("With frequency weekly: the days it is kept (0 = Sunday)"),
    timeOfDay: enumOf(Habit, "timeOfDay").optional().describe("The part of the day it is listed under. A habit has no clock time."),
    habitType: enumOf(Habit, "habitType")
        .optional()
        .describe("boolean: done or not. quantity: counted towards targetQuantity in unit (8 glasses, 20 pages)."),
    targetQuantity: z.number().positive().max(1000000).optional(),
    unit: z.string().max(30).optional(),
    difficulty: enumOf(Habit, "difficulty").optional().describe("Sets its XP: easy 10, medium 15, hard 25"),
};

const plannedFields = {
    date: day.nullable().optional().describe("The day it is planned for (YYYY-MM-DD); null for no day. Not in the past."),
    time: clock.nullable().optional().describe("When on that day, HH:MM; needs a date. null for any time."),
    endTime: clock.nullable().optional().describe("When it ends, HH:MM; needs time, and comes after it"),
};

const goalFields = {
    title: z.string().trim().min(1).max(120),
    note: z.string().max(500).optional(),
    targetDate: day.nullable().optional().describe("The day it should be reached by, or null"),
    milestones: z
        .array(
            z.object({
                id: id("milestone").optional().describe("Keep an existing milestone by sending its id; leave it out for a new one"),
                title: z.string().trim().min(1).max(120),
                done: z.boolean().optional(),
            }),
        )
        .max(MOST_MILESTONES)
        .optional()
        .describe("Replaces the whole list: send every milestone to keep"),
    links: z
        .array(z.object({ kind: itemKind, id: id("routine or habit") }))
        .max(MOST_LINKS)
        .optional()
        .describe("The routines and habits that carry this goal. Replaces the whole list."),
};

const transactionFields = {
    type: enumOf(ExpenseTransaction, "type").optional().describe("expense (the default), income, or transfer between accounts"),
    amount: amount.describe("How much, in the account's currency (rupees unless the account says otherwise)"),
    accountId: id("account").describe("The account it is paid from or into (see get_expenses for the accounts)"),
    category: expenseCategory.optional().describe("What it was for, from the app's own list. Left out: Other"),
    description: z.string().max(500).optional(),
    paymentMethod: enumOf(ExpenseTransaction, "paymentMethod").optional(),
    transferToAccountId: id("account").nullable().optional().describe("For a transfer: the account it goes to"),
    placeName: z.string().max(120).optional().describe("Where it was spent"),
    notes: z.string().max(1000).optional(),
    transactionDate: isoDate.nullable().optional().describe("When it happened. Left out: now."),
    subscriptionId: id("subscription")
        .nullable()
        .optional()
        .describe("Paying a subscription: its id. This is how a subscription is marked as paid; its next due date moves on."),
};

const subscriptionFields = {
    name: z.string().trim().min(1).max(120),
    amount: z.number().min(0).max(1e12),
    category: expenseCategory.optional(),
    frequency: enumOf(ExpenseSubscription, "frequency").optional(),
    accountId: id("account").describe("The account it is paid from"),
    description: z.string().max(500).optional(),
    reminderDays: z.number().int().min(0).max(365).optional().describe("How many days before it is due to remind"),
    nextDueDate: isoDate.optional().describe("When it is next due. Left out when adding: now."),
};

// Every field optional, for a change: only what is sent is changed
const optional = (fields) => Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()]));

// ── What a tool answers ──

// What a person's data carries that is of no use to Claude: the owner, version keys, internal bookkeeping
const HIDDEN = new Set(["user", "__v", "clientKey", "updatedAt", "purgedAt"]);

const tidy = (value) => {
    if (Array.isArray(value)) return value.map(tidy);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !HIDDEN.has(key))
                .map(([key, inner]) => [key === "_id" ? "id" : key, tidy(inner)]),
        );
    }
    return value;
};

const failed = (result) => result.status >= 400;
const messageOf = (result) => result.body?.message || `The request was refused (${result.status}).`;

const answer = (result) =>
    failed(result)
        ? { isError: true, content: [{ type: "text", text: messageOf(result) }] }
        : { content: [{ type: "text", text: JSON.stringify(tidy(result.body)) }] };

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(tidy(data)) }] });

// The first of several answers that failed, if any did
const firstFailure = (...results) => results.find(failed);

// Makes several things one at a time (in order, so habits keep the order they were given in) and says which failed
const addEach = async (call, path, items, made) => {
    const added = [];
    const refused = [];

    for (const [index, item] of items.entries()) {
        const result = await call({ method: "POST", path, body: item });
        if (failed(result)) {
            refused.push({ index, title: item.title ?? item.description ?? null, error: messageOf(result) });
        } else {
            added.push(made(result.body));
        }
    }

    const data = { added, ...(refused.length ? { failed: refused } : {}) };
    return added.length === 0 && refused.length > 0
        ? { isError: true, content: [{ type: "text", text: JSON.stringify(tidy(data)) }] }
        : ok(data);
};

const plural = { routine: "routines", habit: "habits" };

const addDays = (date, days) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

// Annotations, as Claude shows them when asking the person to allow a tool
const READS = { readOnlyHint: true, openWorldHint: false };
const ADDS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const CHANGES = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const REMOVES = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

// ── The tools ──
// Each: name, title, description, input (a zod object, or nothing), annotations, and run(args, call).

export const TOOLS = [
    // ─── Reading ───
    {
        name: "get_today",
        title: "Read today",
        description:
            "Today's date in the person's timezone, the routines due today (todayLog says whether and when each was done), " +
            "every habit with today's progress (todayLog) and whether today is one of its days (dueToday), and the to-dos " +
            "planned for today or left undone from earlier days. Start here.",
        annotations: READS,
        run: async (_args, call) => {
            const [habits, routines, todos] = await Promise.all([
                call({ method: "GET", path: "/api/habits" }),
                call({ method: "GET", path: "/api/routines" }),
                call({ method: "GET", path: "/api/todos" }),
            ]);
            const failure = firstFailure(habits, routines, todos);
            if (failure) return answer(failure);

            const today = habits.body.today;
            const all = todos.body.lists.flatMap((list) =>
                list.todos.map((todo) => ({ ...todo, list: list.name, listId: list._id })),
            );

            return ok({
                today,
                routines: routines.body.routines,
                habits: habits.body.habits,
                todos: {
                    today: all.filter((todo) => todo.date === today),
                    leftFromEarlierDays: all.filter((todo) => todo.date && todo.date < today && !todo.done),
                },
            });
        },
    },
    {
        name: "get_plan",
        title: "Read the whole plan",
        description:
            "Every routine (repeating ones whatever days they fall on, and one-off ones) and every habit, with their ids. " +
            "Read this before adding things, so new ones fit around what is there and nothing is added twice.",
        annotations: READS,
        run: async (_args, call) => {
            const [routines, habits] = await Promise.all([
                call({ method: "GET", path: "/api/routines/all" }),
                call({ method: "GET", path: "/api/habits" }),
            ]);
            const failure = firstFailure(routines, habits);
            if (failure) return answer(failure);
            return ok({ today: habits.body.today, routines: routines.body.routines, habits: habits.body.habits });
        },
    },
    {
        name: "get_routines_on",
        title: "Read the routines on a day",
        description: "The routines due on one day (today or a day ahead), with whether each was done if the day has begun.",
        input: z.object({ date: day }),
        annotations: READS,
        run: ({ date }, call) => call({ method: "GET", path: "/api/routines", query: { date } }).then(answer),
    },
    {
        name: "get_day",
        title: "Read a past day",
        description:
            "How one day went: what was due, what was done, done late or missed, and the XP earned and lost. For today, how it is going so far.",
        input: z.object({ date: day }),
        annotations: READS,
        run: ({ date }, call) => call({ method: "GET", path: `/api/history/days/${date}` }).then(answer),
    },
    {
        name: "get_history",
        title: "Read past days",
        description: "Day by day, how a stretch of days went (at most 366 days, both ends included).",
        input: z.object({ from: day, to: day }),
        annotations: READS,
        run: ({ from, to }, call) => call({ method: "GET", path: "/api/history/days", query: { from, to } }).then(answer),
    },
    {
        name: "get_item_history",
        title: "Read one routine's or habit's record",
        description: "The days one routine or habit was done, done late, partly done or missed.",
        input: z.object({ kind: itemKind, id: id("routine or habit") }),
        annotations: READS,
        run: ({ kind, id: itemId }, call) =>
            call({ method: "GET", path: `/api/${plural[kind]}/${itemId}/history` }).then(answer),
    },
    {
        name: "get_progress",
        title: "Read level, XP and streaks",
        description: "The person's level, XP, coins, current and best streak, and how the streak stands today.",
        annotations: READS,
        run: async (_args, call) => {
            const [stats, streak] = await Promise.all([
                call({ method: "GET", path: "/api/gamification/stats" }),
                call({ method: "GET", path: "/api/streaks/info" }),
            ]);
            const failure = firstFailure(stats, streak);
            if (failure) return answer(failure);
            return ok({ stats: stats.body, streak: streak.body });
        },
    },
    {
        name: "get_xp_ledger",
        title: "Read the XP ledger",
        description:
            "Every XP gain and loss, newest first, a page at a time. To read further back, pass the `next` value of the previous page as before.",
        input: z.object({
            before: z.string().max(60).optional(),
            limit: z.number().int().min(1).max(100).optional(),
        }),
        annotations: READS,
        run: ({ before, limit }, call) =>
            call({ method: "GET", path: "/api/history/ledger", query: { before, limit } }).then(answer),
    },
    {
        name: "get_todos",
        title: "Read the to-do lists",
        description:
            "Every to-do list with its to-dos: the ones with no day, open planned ones, and planned ones finished in the last six weeks. " +
            "Give from and to (at most 366 days apart) to read the to-dos planned in an older stretch instead.",
        input: z.object({ from: day.optional(), to: day.optional() }),
        annotations: READS,
        run: ({ from, to }, call) =>
            (from && to
                ? call({ method: "GET", path: "/api/todos/planned", query: { from, to } })
                : call({ method: "GET", path: "/api/todos" })
            ).then(answer),
    },
    {
        name: "get_week",
        title: "Read a week",
        description:
            "One week's page: its focus (at most five things), notes, review (wentWell, better), and the to-dos planned on its seven days. " +
            "start is the week's first day as the person's app shows it (Sunday or Monday, depending on their device); " +
            "if unsure which, read both and use the one that has content, or ask.",
        input: z.object({ start: day.describe("The week's first day, YYYY-MM-DD") }),
        annotations: READS,
        run: async ({ start }, call) => {
            const [week, todos] = await Promise.all([
                call({ method: "GET", path: `/api/weeks/${start}` }),
                call({ method: "GET", path: "/api/todos/planned", query: { from: start, to: addDays(start, 6) } }),
            ]);
            const failure = firstFailure(week, todos);
            if (failure) return answer(failure);
            return ok({ ...week.body, todos: todos.body.todos });
        },
    },
    {
        name: "get_goals",
        title: "Read goals",
        description: "Every goal with its milestones and the routines and habits that carry it.",
        annotations: READS,
        run: (_args, call) => call({ method: "GET", path: "/api/goals" }).then(answer),
    },
    {
        name: "get_expenses",
        title: "Read expenses",
        description:
            "A month of money: the accounts with their balances and ids, the month's totals by category, recent transactions, " +
            "subscriptions, spending limits (budgets) and places spent at before.",
        input: z.object({ month: month.optional() }),
        annotations: READS,
        run: ({ month: when }, call) =>
            call({ method: "GET", path: "/api/expenses/summary", query: { month: when } }).then(answer),
    },
    {
        name: "get_transactions",
        title: "Read transactions",
        description: "One month's transactions, newest first, a page at a time (limit, 100 unless given; offset to skip the newest).",
        input: z.object({
            month: month.optional(),
            limit: z.number().int().min(1).max(200).optional(),
            offset: z.number().int().min(0).optional(),
        }),
        annotations: READS,
        run: ({ month: when, limit, offset }, call) =>
            call({ method: "GET", path: "/api/expenses/transactions", query: { month: when, limit, offset } }).then(answer),
    },
    {
        name: "get_trash",
        title: "Read Trash",
        description: "What has been deleted and can still be brought back, and when each will be let go of for good.",
        annotations: READS,
        run: (_args, call) => call({ method: "GET", path: "/api/trash" }).then(answer),
    },
    {
        name: "get_archive",
        title: "Read Archive",
        description: "Routines and habits retired from the plan, kept with their records. Each can be brought back.",
        annotations: READS,
        run: (_args, call) => call({ method: "GET", path: "/api/archive" }).then(answer),
    },

    // ─── Routines and habits ───
    {
        name: "add_routines",
        title: "Add routines",
        description:
            "Adds routines: things done at a time of day. A repeating one has isRecurring true and recurringDays; " +
            "a one-off one has isRecurring false and a date. Each is worth 10 XP when done; left undone when the day closes, " +
            "it costs 5. A routine added today is due today if today is one of its days, so say so when its time has already passed.",
        input: z.object({
            routines: z
                .array(z.object(routineFields))
                .min(1)
                .max(20)
                .describe("The routines to add, in the order to add them"),
        }),
        annotations: ADDS,
        run: ({ routines }, call) => addEach(call, "/api/routines", routines, (body) => body),
    },
    {
        name: "update_routine",
        title: "Change a routine",
        description: "Changes a routine. Only the fields sent change.",
        input: z.object({ id: id("routine"), ...optional(routineFields) }),
        annotations: CHANGES,
        run: ({ id: routineId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/routines/${routineId}`, body: fields }).then(answer),
    },
    {
        name: "complete_routine",
        title: "Mark a routine done",
        description:
            "Marks a routine done today (or on date, if that day is still open), and earns its XP. Done more than 15 minutes after its end time, it pays half.",
        input: z.object({ id: id("routine"), date: day.optional() }),
        annotations: CHANGES,
        run: ({ id: routineId, date }, call) =>
            call({ method: "POST", path: `/api/routines/${routineId}/complete`, body: date ? { date } : {} }).then(answer),
    },
    {
        name: "uncomplete_routine",
        title: "Mark a routine not done",
        description: "Takes back a routine marked done today (or on date), and the XP it earned.",
        input: z.object({ id: id("routine"), date: day.optional() }),
        annotations: CHANGES,
        run: ({ id: routineId, date }, call) =>
            call({ method: "DELETE", path: `/api/routines/${routineId}/complete`, body: date ? { date } : {} }).then(answer),
    },
    {
        name: "add_habits",
        title: "Add habits",
        description:
            "Adds habits: things kept during the day, with no clock time. Each is listed under a part of the day, " +
            "is worth 10, 15 or 25 XP by difficulty, and costs a third of that if left undone when the day closes. " +
            "A habit added today counts from today.",
        input: z.object({
            habits: z.array(z.object(habitFields)).min(1).max(20).describe("The habits to add, in the order to list them"),
        }),
        annotations: ADDS,
        run: ({ habits }, call) => addEach(call, "/api/habits", habits, (body) => body.habit),
    },
    {
        name: "update_habit",
        title: "Change a habit",
        description: "Changes a habit. Only the fields sent change.",
        input: z.object({ id: id("habit"), ...optional(habitFields) }),
        annotations: CHANGES,
        run: ({ id: habitId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/habits/${habitId}`, body: fields }).then(answer),
    },
    {
        name: "log_habit",
        title: "Log a habit",
        description:
            "Logs a habit for today: a done-or-not habit is marked done; a counted one has quantity added to today's count " +
            "(1 if left out). Reaching the target earns its XP. Only today can be logged.",
        input: z.object({
            id: id("habit"),
            quantity: z.number().positive().max(1000000).optional(),
            note: z.string().max(500).optional(),
        }),
        annotations: ADDS,
        run: ({ id: habitId, ...body }, call) =>
            call({ method: "POST", path: `/api/habits/${habitId}/log`, body }).then(answer),
    },
    {
        name: "set_habit_count",
        title: "Set a habit's count for today",
        description: "Sets today's count for a habit outright; 0 clears today (marks it not done) and takes back its XP.",
        input: z.object({ id: id("habit"), quantity: z.number().min(0).max(1000000) }),
        annotations: CHANGES,
        run: ({ id: habitId, quantity }, call) =>
            call({ method: "PUT", path: `/api/habits/${habitId}/log`, body: { quantity } }).then(answer),
    },
    {
        name: "delete_item",
        title: "Delete a routine or habit",
        description:
            "Moves a routine or habit to Trash, where it can be brought back for a while (restore_from_trash). " +
            "The XP it earned goes with it, and comes back if it is restored. Ask the person before deleting.",
        input: z.object({ kind: itemKind, id: id("routine or habit") }),
        annotations: REMOVES,
        run: ({ kind, id: itemId }, call) => call({ method: "DELETE", path: `/api/${plural[kind]}/${itemId}` }).then(answer),
    },
    {
        name: "pause_item",
        title: "Pause a routine or habit",
        description: "Pauses a routine or habit for a number of days, from today or from a later day: it is not due, and costs nothing, while paused.",
        input: z.object({
            kind: itemKind,
            id: id("routine or habit"),
            days: z.number().int().min(1).max(365),
            from: day.optional().describe("The first day of the pause; today if left out. Not in the past."),
        }),
        annotations: CHANGES,
        run: ({ kind, id: itemId, days, from }, call) =>
            call({ method: "POST", path: `/api/${plural[kind]}/${itemId}/pause`, body: { days, ...(from ? { from } : {}) } }).then(
                answer,
            ),
    },
    {
        name: "resume_item",
        title: "End a pause",
        description: "Ends a routine's or habit's pause early.",
        input: z.object({ kind: itemKind, id: id("routine or habit") }),
        annotations: CHANGES,
        run: ({ kind, id: itemId }, call) =>
            call({ method: "DELETE", path: `/api/${plural[kind]}/${itemId}/pause` }).then(answer),
    },
    {
        name: "archive_item",
        title: "Retire a routine or habit",
        description: "Retires a routine or habit to Archive: out of the plan for good, but kept with its record and XP, and it can be brought back.",
        input: z.object({ kind: itemKind, id: id("routine or habit") }),
        annotations: CHANGES,
        run: ({ kind, id: itemId }, call) =>
            call({ method: "POST", path: `/api/${plural[kind]}/${itemId}/archive` }).then(answer),
    },
    {
        name: "unarchive_item",
        title: "Bring back from Archive",
        description: "Brings a retired routine or habit back into the plan.",
        input: z.object({ kind: itemKind, id: id("routine or habit") }),
        annotations: CHANGES,
        run: ({ kind, id: itemId }, call) =>
            call({ method: "POST", path: `/api/${plural[kind]}/${itemId}/unarchive` }).then(answer),
    },

    // ─── To-dos ───
    {
        name: "add_todos",
        title: "Add to-dos",
        description:
            "Adds to-dos: things to get done once, with no XP and no penalty. Each goes on a list (the general list if listId is " +
            "left out) and may be planned for a day, and a time on it.",
        input: z.object({
            todos: z
                .array(
                    z.object({
                        title: z.string().trim().min(1).max(200),
                        listId: id("list").optional().describe("The list to put it on; the general list if left out"),
                        ...plannedFields,
                    }),
                )
                .min(1)
                .max(20),
        }),
        annotations: ADDS,
        run: ({ todos }, call) => addEach(call, "/api/todos", todos, (body) => body.todo),
    },
    {
        name: "update_todo",
        title: "Change a to-do",
        description: "Changes a to-do: its title, done or not, its list, or its day and time. Only the fields sent change.",
        input: z.object({
            id: id("to-do"),
            title: z.string().trim().min(1).max(200).optional(),
            done: z.boolean().optional(),
            listId: id("list").optional().describe("Moves it to this list"),
            ...plannedFields,
        }),
        annotations: CHANGES,
        run: ({ id: todoId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/todos/${todoId}`, body: fields }).then(answer),
    },
    {
        name: "delete_todo",
        title: "Delete a to-do",
        description: "Moves a to-do to Trash, where it can be brought back for a while.",
        input: z.object({ id: id("to-do") }),
        annotations: REMOVES,
        run: ({ id: todoId }, call) => call({ method: "DELETE", path: `/api/todos/${todoId}` }).then(answer),
    },
    {
        name: "add_todo_list",
        title: "Add a to-do list",
        description: "Makes a new, empty to-do list.",
        input: z.object({ name: z.string().trim().min(1).max(60) }),
        annotations: ADDS,
        run: ({ name }, call) => call({ method: "POST", path: "/api/todos/lists", body: { name } }).then(answer),
    },
    {
        name: "rename_todo_list",
        title: "Rename a to-do list",
        description: "Renames a to-do list. The general list can't be renamed.",
        input: z.object({ id: id("list"), name: z.string().trim().min(1).max(60) }),
        annotations: CHANGES,
        run: ({ id: listId, name }, call) =>
            call({ method: "PUT", path: `/api/todos/lists/${listId}`, body: { name } }).then(answer),
    },
    {
        name: "delete_todo_list",
        title: "Delete a to-do list",
        description: "Moves a to-do list, with its to-dos, to Trash. The general list can't be deleted. Ask the person first.",
        input: z.object({ id: id("list") }),
        annotations: REMOVES,
        run: ({ id: listId }, call) => call({ method: "DELETE", path: `/api/todos/lists/${listId}` }).then(answer),
    },
    {
        name: "clear_done_todos",
        title: "Clear finished to-dos",
        description: "Moves the finished to-dos on one list to Trash.",
        input: z.object({ listId: id("list") }),
        annotations: REMOVES,
        run: ({ listId }, call) => call({ method: "POST", path: `/api/todos/lists/${listId}/clear` }).then(answer),
    },

    // ─── The week ───
    {
        name: "update_week",
        title: "Change a week's page",
        description:
            `Sets a week's focus (at most ${MOST_FOCUS} things, each optionally linked to a goal), notes, or review. ` +
            "Each field sent replaces what is there: to change one focus line, send the whole list with the ids of the lines to keep. " +
            "To plan things on the week's days, add to-dos with a date instead.",
        input: z.object({
            start: day.describe("The week's first day, as get_week takes it"),
            focus: z
                .array(
                    z.object({
                        id: id("focus line").optional().describe("Keep an existing line by sending its id"),
                        title: z.string().trim().min(1).max(120),
                        done: z.boolean().optional(),
                        goalId: id("goal").nullable().optional(),
                    }),
                )
                .max(MOST_FOCUS)
                .optional(),
            notes: z.string().max(4000).optional(),
            wentWell: z.string().max(4000).optional().describe("Review: what went well"),
            better: z.string().max(4000).optional().describe("Review: what to do better"),
        }),
        annotations: CHANGES,
        run: ({ start, focus, ...rest }, call) =>
            call({
                method: "PUT",
                path: `/api/weeks/${start}`,
                body: {
                    ...rest,
                    ...(focus ? { focus: focus.map(({ id: lineId, ...line }) => (lineId ? { _id: lineId, ...line } : line)) } : {}),
                },
            }).then(answer),
    },

    // ─── Goals ───
    {
        name: "add_goal",
        title: "Add a goal",
        description: "Adds a goal, with milestones and the routines and habits that work towards it if given.",
        input: z.object(goalFields),
        annotations: ADDS,
        run: (goal, call) => call({ method: "POST", path: "/api/goals", body: goal }).then(answer),
    },
    {
        name: "update_goal",
        title: "Change a goal",
        description: "Changes a goal, or marks it reached. Only the fields sent change; milestones and links replace their whole lists.",
        input: z.object({ id: id("goal"), ...optional(goalFields), reached: z.boolean().optional() }),
        annotations: CHANGES,
        run: ({ id: goalId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/goals/${goalId}`, body: fields }).then(answer),
    },
    {
        name: "set_milestone",
        title: "Tick a milestone",
        description: "Marks one milestone of a goal done or not done.",
        input: z.object({ goalId: id("goal"), milestoneId: id("milestone"), done: z.boolean() }),
        annotations: CHANGES,
        run: ({ goalId, milestoneId, done }, call) =>
            call({ method: "PUT", path: `/api/goals/${goalId}/milestones/${milestoneId}`, body: { done } }).then(answer),
    },
    {
        name: "delete_goal",
        title: "Delete a goal",
        description: "Moves a goal to Trash, where it can be brought back for a while. Ask the person first.",
        input: z.object({ id: id("goal") }),
        annotations: REMOVES,
        run: ({ id: goalId }, call) => call({ method: "DELETE", path: `/api/goals/${goalId}` }).then(answer),
    },

    // ─── Money ───
    {
        name: "add_transactions",
        title: "Log expenses",
        description:
            "Logs money spent, received or moved between accounts. Each needs an amount and an account (get_expenses lists the accounts and their ids).",
        input: z.object({ transactions: z.array(z.object(transactionFields)).min(1).max(20) }),
        annotations: ADDS,
        run: ({ transactions }, call) => addEach(call, "/api/expenses/transactions", transactions, (body) => body.transaction),
    },
    {
        name: "update_transaction",
        title: "Change a transaction",
        description: "Changes a logged transaction. Only the fields sent change.",
        input: z.object({ id: id("transaction"), ...optional(transactionFields) }),
        annotations: CHANGES,
        run: ({ id: transactionId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/expenses/transactions/${transactionId}`, body: fields }).then(answer),
    },
    {
        name: "delete_transaction",
        title: "Delete a transaction",
        description: "Moves a transaction to Trash, where it can be brought back for a while.",
        input: z.object({ id: id("transaction") }),
        annotations: REMOVES,
        run: ({ id: transactionId }, call) =>
            call({ method: "DELETE", path: `/api/expenses/transactions/${transactionId}` }).then(answer),
    },
    {
        name: "add_subscription",
        title: "Add a subscription",
        description: "Adds something paid again and again (weekly, monthly or yearly), to be reminded of before it is due.",
        input: z.object(subscriptionFields),
        annotations: ADDS,
        run: (subscription, call) => call({ method: "POST", path: "/api/expenses/subscriptions", body: subscription }).then(answer),
    },
    {
        name: "update_subscription",
        title: "Change a subscription",
        description: "Changes a subscription, or stops it (isActive false). To mark one paid, log a transaction with its subscriptionId.",
        input: z.object({ id: id("subscription"), ...optional(subscriptionFields), isActive: z.boolean().optional() }),
        annotations: CHANGES,
        run: ({ id: subscriptionId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/expenses/subscriptions/${subscriptionId}`, body: fields }).then(answer),
    },
    {
        name: "delete_subscription",
        title: "Delete a subscription",
        description: "Moves a subscription to Trash, where it can be brought back for a while.",
        input: z.object({ id: id("subscription") }),
        annotations: REMOVES,
        run: ({ id: subscriptionId }, call) =>
            call({ method: "DELETE", path: `/api/expenses/subscriptions/${subscriptionId}` }).then(answer),
    },
    {
        name: "set_budget",
        title: "Set a spending limit",
        description: "Sets the monthly spending limit for a category (making it if there is none), or turns it off (isActive false).",
        input: z.object({
            category: expenseCategory,
            monthlyLimit: z.number().min(0).max(1e12),
            alertThreshold: z.number().min(0).max(1).optional().describe("The share of the limit at which to warn, 0 to 1"),
            isActive: z.boolean().optional(),
        }),
        annotations: CHANGES,
        run: (budget, call) => call({ method: "POST", path: "/api/expenses/budgets", body: budget }).then(answer),
    },
    {
        name: "update_account",
        title: "Change a money account",
        description: "Renames a money account or sets its opening balance.",
        input: z.object({
            id: id("account"),
            name: z.string().trim().min(1).max(60).optional(),
            openingBalance: z.number().min(-1e12).max(1e12).optional(),
        }),
        annotations: CHANGES,
        run: ({ id: accountId, ...fields }, call) =>
            call({ method: "PUT", path: `/api/expenses/accounts/${accountId}`, body: fields }).then(answer),
    },

    // ─── Trash ───
    {
        name: "restore_from_trash",
        title: "Bring back from Trash",
        description: "Brings something back from Trash exactly as it was (a routine or habit gets its XP back). Claude can't empty Trash or erase from it.",
        input: z.object({
            kind: z.enum(Object.keys(TRASH_KINDS)).describe("What it is, as get_trash names it"),
            id: id("deleted thing"),
        }),
        annotations: CHANGES,
        run: ({ kind, id: trashedId }, call) =>
            call({ method: "POST", path: `/api/trash/${kind}/${trashedId}/restore` }).then(answer),
    },
];
