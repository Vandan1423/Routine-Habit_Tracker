// Fills a test database with two accounts for checking the interface against:
//   demo@example.com   forty days of history with some misses, today partly done, a hundred days of expenses,
//                      to-do lists, goals, and a few things in Trash
//   new@example.com    a fresh account with nothing in it
// Running it again rebuilds both from scratch and touches nothing else.
//
//   MONGO_URI_TEST=mongodb://127.0.0.1:27027/routine_habit_test npm run seed:demo
//
// The database name must end in "_test", the same rule the tests follow. scripts/sandbox.js runs this on start.
// The history is produced by the app's own reward, streak and settlement code, one day at a time,
// so every number adds up the way it would for a real account.

import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

import User from "../src/models/User.js";
import Routine from "../src/models/Routine.js";
import RoutineLog from "../src/models/RoutineLog.js";
import Habit from "../src/models/Habit.js";
import HabitLog from "../src/models/HabitLog.js";
import DailyLog from "../src/models/DailyLog.js";
import XPLog from "../src/models/XPLog.js";
import ExpenseAccount from "../src/models/ExpenseAccount.js";
import ExpenseBudget from "../src/models/ExpenseBudget.js";
import ExpenseSubscription from "../src/models/ExpenseSubscription.js";
import ExpenseTransaction from "../src/models/ExpenseTransaction.js";
import KnownSpendPlace from "../src/models/KnownSpendPlace.js";
import TodoList from "../src/models/TodoList.js";
import Todo from "../src/models/Todo.js";
import Goal from "../src/models/Goal.js";
import { awardXP } from "../src/utils/rewardEngine.js";
import { calculateLevel } from "../src/utils/xpCalculator.js";
import { calculateStreak } from "../src/utils/streakCalculator.js";
import { updateDailyStreak } from "../src/utils/dailyStreakCalculator.js";
import { addDailyXp } from "../src/utils/dailySummary.js";
import { settleEndedDays } from "../src/utils/dailyPenaltyJob.js";
import { moveItemToTrash } from "../src/utils/itemTrash.js";
import { trashStamp } from "../src/utils/trash.js";
import {
    addDays,
    existedOn,
    getTodayIn,
    isHabitScheduledOn,
    isRoutineScheduledOn,
} from "../src/utils/dateRules.js";

export const DEMO_EMAIL = "demo@example.com";
export const NEW_EMAIL = "new@example.com";
// Only ever exists in a test database
export const DEMO_PASSWORD = "demo-password";

const HISTORY_DAYS = 40;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const ROUTINES = [
    { key: "wake", title: "Wake up and water", startTime: "06:30", category: "health", days: EVERY_DAY },
    { key: "workout", title: "Workout", startTime: "07:00", endTime: "07:45", category: "fitness", days: [1, 2, 3, 4, 5, 6] },
    { key: "walk", title: "Long walk", startTime: "08:00", endTime: "09:00", category: "fitness", days: [0] },
    { key: "inbox", title: "Clear the inbox", startTime: "13:00", endTime: "13:30", category: "work", days: WEEKDAYS },
    { key: "deep", title: "Deep work", startTime: "14:00", endTime: "16:00", category: "work", days: WEEKDAYS },
    { key: "cook", title: "Cook dinner", startTime: "19:30", category: "personal", days: EVERY_DAY },
    { key: "plan", title: "Plan tomorrow", startTime: "22:00", category: "personal", days: EVERY_DAY },
];

// "at" is when the demo user usually gets to it. Habits carry no clock time of their own, only a part of the day.
const HABITS = [
    { key: "meditate", title: "Meditation", category: "health", difficulty: "medium", timeOfDay: "morning", at: "06:50" },
    { key: "read", title: "Read", category: "learning", difficulty: "medium", habitType: "quantity", targetQuantity: 20, unit: "pages", timeOfDay: "morning", at: "07:50" },
    { key: "water", title: "Drink water", category: "health", difficulty: "easy", habitType: "quantity", targetQuantity: 8, unit: "glasses", at: "18:30" },
    { key: "spanish", title: "Spanish practice", category: "learning", difficulty: "hard", frequency: "weekly", targetDays: [1, 3, 5], timeOfDay: "afternoon", at: "17:15", addedDaysAgo: 10 },
    { key: "journal", title: "Journal", category: "personal", difficulty: "medium", timeOfDay: "evening", at: "21:40" },
];

// What went wrong, by how many days ago. Everything not listed was done, and on time.
// "missed" leaves it undone, "late" finishes a routine well after its end time, a number is how far a quantity habit got.
// An entry for something that wasn't due that day does nothing.
// Anything left undone ends a run of days with everything done (a late routine does not), so the longest run
// is 21 days (34 to 14 days ago), and a run of five ended yesterday.
const SLIPS = {
    1: { journal: "missed" },
    5: { deep: "late" },
    7: { spanish: "missed", water: 6 },
    9: { inbox: "late" },
    13: { cook: "missed", plan: "missed", meditate: "missed", read: "missed", water: 3 },
    27: { workout: "late" },
    35: { plan: "missed", journal: "missed" },
    36: { read: 12 },
    37: { journal: "missed", water: 5 },
    38: { deep: "late" },
    39: { meditate: "missed" },
};

const OWNED_BY_A_USER = [
    Routine,
    RoutineLog,
    Habit,
    HabitLog,
    DailyLog,
    XPLog,
    ExpenseAccount,
    ExpenseBudget,
    ExpenseSubscription,
    ExpenseTransaction,
    KnownSpendPlace,
    TodoList,
    Todo,
    Goal,
];

const addMinutes = (clock, minutes) => {
    const [hours, mins] = clock.split(":").map(Number);
    const total = hours * 60 + mins + minutes;

    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// The clock ("14:05") a timezone shows at a moment
const clockIn = (timezone, moment) =>
    moment.toLocaleTimeString("en-GB", {
        timeZone: timezone,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
    });

// The moment a timezone's calendar and clock show that day and time
const zonedTime = (day, clock, timezone) => {
    const asIfUtc = new Date(`${day}T${clock}:00Z`);
    const shown = new Date(
        `${asIfUtc.toLocaleString("sv-SE", { timeZone: timezone }).replace(" ", "T")}Z`,
    );

    return new Date(asIfUtc.getTime() - (shown.getTime() - asIfUtc.getTime()));
};

// ── Money ──
// About a hundred days of it, so the Expenses screen has three months behind the one that is running.

const MONEY_DAYS = 100;

// What the demo user spends on, and how often. "every" is in days, "on" is a weekday (0 is Sunday) or a day
// of the month, "from" is the account it leaves. An amount wanders a little from day to day: base, plus up to "spread".
const SPENDING = [
    { what: "Lunch", category: "Food & Dining", place: "Office canteen", base: 90, spread: 60, weekdays: WEEKDAYS, method: "upi" },
    { what: "Groceries", category: "Food & Dining", place: "Fresh Basket", base: 1150, spread: 500, weekdays: [6], method: "card" },
    { what: "Vegetables", category: "Food & Dining", place: "Sunday market", base: 260, spread: 120, weekdays: [0], from: "cash", method: "cash" },
    { what: "Dinner out", category: "Food & Dining", place: "Cafe Mocha", base: 680, spread: 420, every: 9, method: "card" },
    { what: "Metro card", category: "Travel", place: "Metro", base: 500, spread: 0, every: 11, method: "upi" },
    { what: "Auto", category: "Travel", place: "", base: 70, spread: 90, every: 4, from: "cash", method: "cash" },
    { what: "Books", category: "Education", place: "Blossom Book House", base: 450, spread: 380, every: 23, method: "upi" },
    { what: "Pharmacy", category: "Health & Fitness", place: "Apollo Pharmacy", base: 240, spread: 300, every: 17, method: "upi" },
    { what: "Film", category: "Entertainment", place: "PVR", base: 380, spread: 160, every: 19, method: "card" },
    { what: "Clothes", category: "Shopping", place: "Westside", base: 1400, spread: 1600, every: 31, method: "card" },
    { what: "Household things", category: "Home & Living", place: "Fresh Basket", base: 320, spread: 400, every: 13, method: "upi" },
    { what: "Rent", category: "Rent/Hotel", place: "", base: 18000, spread: 0, monthDay: 3, method: "bank_transfer" },
    { what: "Electricity", category: "Bills & Utilities", place: "", base: 1650, spread: 500, monthDay: 8, method: "upi" },
    { what: "Phone and internet", category: "Bills & Utilities", place: "", base: 999, spread: 0, monthDay: 12, method: "upi" },
];

const BUDGETS = [
    { category: "Food & Dining", monthlyLimit: 9000 },
    { category: "Travel", monthlyLimit: 2500 },
    { category: "Shopping", monthlyLimit: 1500 },
    { category: "Education", monthlyLimit: 800 },
];

// "dueIn" is days from today; a negative one is already late
const SUBSCRIPTIONS = [
    { name: "Music streaming", amount: 119, category: "Entertainment", frequency: "monthly", dueIn: -2 },
    { name: "Gym", amount: 1500, category: "Health & Fitness", frequency: "monthly", dueIn: 3 },
    { name: "Rent", amount: 18000, category: "Rent/Hotel", frequency: "monthly", dueIn: 25 },
    { name: "Cloud storage", amount: 1300, category: "Bills & Utilities", frequency: "yearly", dueIn: 148 },
    { name: "Weekly magazine", amount: 60, category: "Education", frequency: "weekly", dueIn: 4, isActive: false },
];

const utcDay = (day) => new Date(`${day}T00:00:00Z`);

// The demo account's money: two accounts, a hundred days of transactions, limits and subscriptions
const seedMoney = async (user, today) => {
    const [bank, cash] = await ExpenseAccount.create([
        { user: user._id, name: "Bank", type: "bank", openingBalance: 96500, sortOrder: 0 },
        { user: user._id, name: "Cash", type: "cash", openingBalance: 1800, sortOrder: 1 },
    ]);
    const accountOf = (name) => (name === "cash" ? cash._id : bank._id);

    const transactions = [];
    for (let daysAgo = MONEY_DAYS; daysAgo >= 0; daysAgo -= 1) {
        const day = addDays(today, -daysAgo);
        const date = utcDay(day);
        const weekday = date.getUTCDay();
        const monthDay = date.getUTCDate();
        const add = (fields) =>
            transactions.push({
                user: user._id,
                transactionDate: date,
                // In the order they were made, so a day's list reads the same every time
                createdAt: new Date(date.getTime() + (transactions.length % 600) * 60000),
                ...fields,
            });

        if (monthDay === 1) {
            add({ type: "income", amount: 62000, category: "Other", description: "Salary", account: bank._id, paymentMethod: "bank_transfer", placeName: "Other" });
        }
        if (monthDay === 2 || monthDay === 17) {
            add({ type: "transfer", amount: 2500, category: "Other", description: "Cash for the fortnight", account: bank._id, transferToAccount: cash._id, paymentMethod: "cash", placeName: "Other" });
        }

        for (const [index, item] of SPENDING.entries()) {
            const due =
                (item.weekdays && item.weekdays.includes(weekday)) ||
                (item.every && (daysAgo + index * 3) % item.every === 0) ||
                item.monthDay === monthDay;
            if (!due) continue;

            add({
                type: "expense",
                amount: item.base + (item.spread ? (daysAgo * 37 + index * 11) % item.spread : 0),
                category: item.category,
                description: item.what,
                account: accountOf(item.from),
                paymentMethod: item.method,
                placeName: item.place || "Other",
            });
        }
    }
    // One at a time through save(), which is what works out each one's month
    await ExpenseTransaction.create(transactions);

    const places = new Map();
    for (const transaction of transactions) {
        if (transaction.type !== "expense" || transaction.placeName === "Other") continue;

        const place = places.get(transaction.placeName) ?? {
            user: user._id,
            name: transaction.placeName,
            normalizedName: transaction.placeName.toLowerCase(),
            category: transaction.category,
            transactionCount: 0,
            totalSpent: 0,
        };
        place.transactionCount += 1;
        place.totalSpent += transaction.amount;
        place.lastVisitedAt = transaction.transactionDate;
        places.set(transaction.placeName, place);
    }
    await KnownSpendPlace.create([...places.values()]);

    await ExpenseBudget.create(BUDGETS.map((budget) => ({ user: user._id, ...budget })));
    await ExpenseSubscription.create(
        SUBSCRIPTIONS.map(({ dueIn, ...subscription }) => ({
            user: user._id,
            account: bank._id,
            nextDueDate: utcDay(addDays(today, dueIn)),
            ...subscription,
        })),
    );

    return transactions.length;
};

// ── To-do lists ──
// "done" is how many hours ago it was ticked.
const LISTS = [
    {
        general: true,
        todos: [
            { title: "Renew the gym membership" },
            { title: "Book the dentist" },
            { title: "Reply to Arun about Saturday", done: 20 },
            { title: "Buy a new notebook" },
        ],
    },
    {
        name: "Groceries",
        todos: [{ title: "Rice" }, { title: "Curd" }, { title: "Coriander", done: 3 }, { title: "Dish soap" }],
    },
    {
        name: "Trip to Jaipur",
        todos: [
            { title: "Book the train tickets", done: 50 },
            { title: "Reserve the hotel" },
            { title: "Check the forecast the day before" },
        ],
    },
];

const HOUR_MS = 60 * 60 * 1000;

const seedLists = async (user, now) => {
    let count = 0;

    for (const [place, plan] of LISTS.entries()) {
        const list = await TodoList.create({
            user: user._id,
            name: plan.name ?? "To-do",
            isDefault: Boolean(plan.general),
            createdAt: new Date(now.getTime() - (30 - place) * 24 * HOUR_MS),
        });

        await Todo.create(
            plan.todos.map((todo, index) => ({
                user: user._id,
                list: list._id,
                title: todo.title,
                done: todo.done !== undefined,
                doneAt: todo.done !== undefined ? new Date(now.getTime() - todo.done * HOUR_MS) : null,
                // Made over the last few days, in the order written
                createdAt: new Date(now.getTime() - (96 - index) * HOUR_MS),
            })),
        );
        count += plan.todos.length;
    }

    return count;
};

// ── Goals ──
// "by" is how many days from today, "links" name routines and habits by their key above,
// a milestone's "done" is how many days ago it was ticked.
const GOALS = [
    {
        title: "Run ten kilometres without stopping",
        note: "Slow is fine. The spring race is the excuse.",
        by: 45,
        links: ["workout", "walk"],
        milestones: [
            { title: "Three kilometres", done: 24 },
            { title: "Five kilometres", done: 9 },
            { title: "Eight kilometres" },
            { title: "Ten kilometres" },
        ],
    },
    {
        title: "Hold a conversation in Spanish",
        links: ["spanish"],
        milestones: [{ title: "Finish the beginner course", done: 4 }, { title: "A fifteen-minute call with a tutor" }],
    },
    {
        title: "Read twelve books this year",
        by: 82,
        links: ["read"],
        milestones: [],
    },
    {
        title: "Meditate thirty days in a row",
        links: ["meditate"],
        reached: 6,
        milestones: [{ title: "Ten days", done: 26 }, { title: "Twenty days", done: 16 }, { title: "Thirty days", done: 6 }],
    },
];

const seedGoals = async (user, today, now, itemsByKey) => {
    const daysBefore = (days) => new Date(now.getTime() - days * 24 * HOUR_MS);

    await Goal.create(
        GOALS.map((goal, index) => ({
            user: user._id,
            title: goal.title,
            note: goal.note ?? "",
            targetDate: goal.by ? addDays(today, goal.by) : null,
            links: goal.links.map((key) => itemsByKey.get(key)),
            milestones: goal.milestones.map((milestone) => ({
                title: milestone.title,
                done: milestone.done !== undefined,
                doneAt: milestone.done !== undefined ? daysBefore(milestone.done) : null,
            })),
            reachedAt: goal.reached ? daysBefore(goal.reached) : null,
            createdAt: daysBefore(38 - index),
        })),
    );

    return GOALS.length;
};

const removeAccount = async (email) => {
    const user = await User.findOne({ email });
    if (!user) return;

    await Promise.all(
        OWNED_BY_A_USER.map((model) => model.deleteMany({ user: user._id })),
    );
    await user.deleteOne();
};

/**
 * Rebuilds the demo accounts in the connected database.
 * @param {Object} options
 * @param {String} options.timezone - where the demo user lives. Defaults to this machine's timezone,
 *   so that a browser on the same machine reports the zone the account is already in.
 * @returns {Object} - what was created, for printing
 */
export const seedDemo = async ({
    timezone = process.env.SEED_TIMEZONE ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
} = {}) => {
    const databaseName = mongoose.connection.name;
    if (!databaseName?.endsWith("_test")) {
        throw new Error(
            `Refusing to seed "${databaseName}": the database name must end in "_test".`,
        );
    }

    const startedAt = new Date();
    const today = getTodayIn(timezone, startedAt);
    const nowClock = clockIn(timezone, startedAt);
    const firstDay = addDays(today, -HISTORY_DAYS);
    const day = (daysAgo) => addDays(today, -daysAgo);

    // Unique indexes have to exist before anything relies on them
    await Promise.all(
        Object.values(mongoose.models).map((model) => model.init()),
    );
    await removeAccount(DEMO_EMAIL);
    await removeAccount(NEW_EMAIL);

    await User.create({
        name: "Riya Kapoor",
        email: NEW_EMAIL,
        password: DEMO_PASSWORD,
        timezone,
        penaltiesSettledThrough: day(1),
    });

    const user = await User.create({
        name: "Maya Iyer",
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        timezone,
        // Missed tasks count from the first day of the history
        penaltiesSettledThrough: addDays(firstDay, -1),
        createdAt: zonedTime(addDays(firstDay, -2), "09:00", timezone),
    });

    // The reward and penalty code stamps each XP entry with the real clock. Move the ones just written
    // to the moment they stand for, so the XP history reads as forty days and not as one burst.
    const stamp = (when) =>
        XPLog.updateMany(
            { user: user._id, createdAt: { $gte: startedAt } },
            { createdAt: when },
        );

    const addedOn = (daysAgo) => zonedTime(day(daysAgo), "09:00", timezone);

    const routines = [];
    for (const [order, plan] of ROUTINES.entries()) {
        const { key, days, ...fields } = plan;
        const routine = await Routine.create({
            ...fields,
            user: user._id,
            isRecurring: true,
            recurringDays: days,
            order,
            createdAt: addedOn(HISTORY_DAYS + 2),
        });
        routines.push({ key, routine });
    }

    // Two one-off tasks: one done a few days back, one still open today
    const passport = await Routine.create({
        user: user._id,
        title: "Send the passport form",
        startTime: "16:00",
        category: "personal",
        date: day(3),
        order: routines.length,
        createdAt: addedOn(5),
    });
    routines.push({ key: "passport", routine: passport });
    await Routine.create({
        user: user._id,
        title: "Call the bank",
        startTime: "11:30",
        endTime: "12:00",
        category: "personal",
        date: today,
        order: routines.length,
        createdAt: addedOn(1),
    });

    const habits = [];
    for (const plan of HABITS) {
        const { key, at, addedDaysAgo = HISTORY_DAYS + 2, ...fields } = plan;
        const habit = await Habit.create({
            ...fields,
            user: user._id,
            createdAt: addedOn(addedDaysAgo),
        });
        habits.push({ key, at, habit });
    }

    // The same steps as completeRoutine in routineController.js, for a day and time of our choosing
    const completeRoutine = async (routine, date, clock, late) => {
        const when = zonedTime(date, clock, timezone);
        const xpEarned = late
            ? Math.floor(routine.xpReward / 2)
            : routine.xpReward;

        await RoutineLog.create({
            routine: routine._id,
            user: user._id,
            date,
            completedAt: clock,
            wasOnTime: !late,
            xpEarned,
            createdAt: when,
        });
        await awardXP(user._id, xpEarned, "routine_complete", {
            routineId: routine._id.toString(),
            wasOnTime: !late,
        });
        await addDailyXp(user._id, date, xpEarned);
        await updateDailyStreak(user._id, date);
        await stamp(when);
    };

    // The same steps as logHabit in habitController.js. A quantity short of the target logs progress and earns nothing.
    const logHabit = async (habit, date, clock, quantity) => {
        const when = zonedTime(date, clock, timezone);
        const completed =
            habit.habitType !== "quantity" || quantity >= habit.targetQuantity;

        await HabitLog.create({
            habit: habit._id,
            user: user._id,
            date,
            quantity: habit.habitType === "quantity" ? quantity : habit.targetQuantity,
            completed,
            xpEarned: completed ? habit.xpReward : undefined,
            createdAt: when,
        });

        if (completed) {
            habit.currentStreak = await calculateStreak(habit._id, user._id, date);
            habit.bestStreak = Math.max(habit.bestStreak, habit.currentStreak);
            habit.totalCompletions = await HabitLog.countDocuments({
                habit: habit._id,
                completed: true,
            });
            await habit.save();

            await awardXP(user._id, habit.xpReward, "habit_complete", {
                habitId: habit._id,
                habitTitle: habit.title,
                streakCount: habit.currentStreak,
            });
            await addDailyXp(user._id, date, habit.xpReward);
        }

        await updateDailyStreak(user._id, date);
        await stamp(when);
    };

    // Everything due on a day that got done, in the order the day went
    const liveThrough = async (date, slips, { until = "24:00" } = {}) => {
        const done = [];

        for (const { key, routine } of routines) {
            if (!isRoutineScheduledOn(routine, date)) continue;
            if (!existedOn(routine, date, timezone)) continue;
            if (slips[key] === "missed") continue;

            // On time is a few minutes after it starts; late is well past the end
            const late = slips[key] === "late";
            const clock = late
                ? addMinutes(routine.endTime, 40)
                : addMinutes(routine.startTime, 5);
            done.push({
                clock,
                run: () => completeRoutine(routine, date, clock, late),
            });
        }

        for (const { key, at, habit } of habits) {
            if (!isHabitScheduledOn(habit, date)) continue;
            if (!existedOn(habit, date, timezone)) continue;
            if (slips[key] === "missed") continue;

            const quantity = slips[key] ?? habit.targetQuantity;
            done.push({
                clock: at,
                run: () => logHabit(habit, date, at, quantity),
            });
        }

        done.sort((a, b) => a.clock.localeCompare(b.clock));
        for (const step of done) {
            if (step.clock <= until) await step.run();
        }
    };

    for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo--) {
        await liveThrough(day(daysAgo), SLIPS[daysAgo] ?? {});

        // Midnight passes: the day is closed and whatever was left undone is charged
        const nextMorning = zonedTime(day(daysAgo - 1), "00:05", timezone);
        await settleEndedDays(user, nextMorning);
        await stamp(nextMorning);
    }

    // Today so far: the morning went to plan, the afternoon and evening are still open whatever the time is,
    // and the water count is partway there.
    const morningEnds = nowClock < "12:00" ? nowClock : "12:00";
    await liveThrough(today, { water: "missed" }, { until: morningEnds });

    const glasses = Math.min(6, Number(nowClock.slice(0, 2)) - 8);
    if (glasses > 0) {
        const water = habits.find(({ key }) => key === "water").habit;
        await logHabit(water, today, addMinutes(nowClock, -1), glasses);
    }

    const transactions = await seedMoney(user, today);
    const todos = await seedLists(user, startedAt);
    const itemsByKey = new Map([
        ...routines.map(({ key, routine }) => [key, { kind: "routine", item: routine._id }]),
        ...habits.map(({ key, habit }) => [key, { kind: "habit", item: habit._id }]),
    ]);
    const goals = await seedGoals(user, today, startedAt, itemsByKey);

    // A few things in Trash, deleted at different times. The one-off task takes the XP it earned with it,
    // through the same code a delete in the app runs.
    const hoursAgo = (hours) => new Date(startedAt.getTime() - hours * HOUR_MS);
    const account = await User.findById(user._id);
    await moveItemToTrash(account, "routine", passport._id);
    await Routine.updateOne({ _id: passport._id }, trashStamp(account, hoursAgo(26)));
    await stamp(hoursAgo(26));
    const [auto] = await ExpenseTransaction.find({ user: user._id, description: "Auto" })
        .sort({ transactionDate: -1 })
        .limit(1);
    if (auto) await ExpenseTransaction.updateOne({ _id: auto._id }, trashStamp(account, hoursAgo(5)));
    const groceries = await TodoList.findOne({ user: user._id, name: "Groceries" });
    await Todo.create({
        user: user._id,
        list: groceries._id,
        title: "Paneer",
        createdAt: hoursAgo(90),
        ...trashStamp(account, hoursAgo(2)),
    });

    const [finalAccount, xpEntries, days] = await Promise.all([
        User.findById(user._id),
        XPLog.countDocuments({ user: user._id }),
        DailyLog.countDocuments({ user: user._id }),
    ]);
    const { level, currentXp, xpForNext } = calculateLevel(finalAccount.xp);

    return {
        database: databaseName,
        timezone,
        today,
        accounts: [DEMO_EMAIL, NEW_EMAIL],
        password: DEMO_PASSWORD,
        demo: {
            level,
            xp: `${currentXp} / ${xpForNext}`,
            coins: finalAccount.coins,
            currentStreak: finalAccount.currentStreak,
            bestStreak: finalAccount.bestStreak,
            routines: routines.length + 1,
            habits: habits.length,
            daysRecorded: days,
            xpEntries,
            transactions,
            todos,
            goals,
            inTrash: 3,
        },
    };
};

// Run directly: connect, seed, report
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const uri = process.env.MONGO_URI_TEST;
    if (!uri) {
        console.error(
            'Set MONGO_URI_TEST to a database whose name ends in "_test".',
        );
        process.exit(1);
    }

    await mongoose.connect(uri);
    try {
        console.log(await seedDemo());
    } finally {
        await mongoose.disconnect();
    }
}
