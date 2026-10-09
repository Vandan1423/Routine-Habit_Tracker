import DailyLog from "../models/DailyLog.js";
import XPLog from "../models/XPLog.js";
import { addDays } from "./dateRules.js";

// Looking back over days that have ended. Like an item's history (itemHistory.js), everything here is read
// from what was recorded at the time: the day's summary, the completion logs and the XP ledger.
// Nothing is worked out from today's plan, so editing or deleting an item never rewrites the past.

const DAY_MS = 24 * 60 * 60 * 1000;

// The ledger entries a closed day leaves behind for what was left undone, and the kind of item each is about
export const MISSED_REASONS = { routine_missed: "routine", habit_missed: "habit" };

// The item a ledger entry is about, as text. The ledger has held the id both as an id and as text.
export const itemIdOf = (entry) =>
    (entry.metadata?.routineId ?? entry.metadata?.habitId)?.toString() ?? null;

/**
 * The penalties charged for the days from one date to another, oldest first.
 * A miss that cost nothing (there was no XP left to take) left no entry, and so is not here.
 */
export const missedEntriesIn = (userId, from, to) =>
    XPLog.find({
        user: userId,
        reason: { $in: Object.keys(MISSED_REASONS) },
        "metadata.date": { $gte: from, $lte: to },
        // A day is charged once it has ended, so none of these was written before its day began anywhere
        createdAt: { $gte: new Date(Date.parse(`${from}T00:00:00Z`) - DAY_MS) },
    }).sort({ createdAt: 1 });

// The XP each day lost to what was left undone on it: date => amount
export const lossByDay = (penalties) => {
    const lost = new Map();
    for (const entry of penalties) {
        const date = entry.metadata.date;
        lost.set(date, (lost.get(date) ?? 0) - entry.amount);
    }
    return lost;
};

/**
 * The days that decide the account's run.
 * @returns {Object} - perfect: every day with everything due done; rest: every day with nothing due
 */
export const streakDaysOf = async (userId) => {
    const logs = await DailyLog.find({
        user: userId,
        $or: [{ isPerfectDay: true }, { isRestDay: true }],
    }).select("date isPerfectDay");

    const days = { perfect: new Set(), rest: new Set() };
    for (const log of logs) {
        (log.isPerfectDay ? days.perfect : days.rest).add(log.date);
    }
    return days;
};

// How many days in a row had everything due done, up to and including this one.
// A day with nothing due is stepped over: it neither adds to the run nor ends it.
export const runEndingOn = ({ perfect, rest }, date) => {
    let run = 0;
    for (let day = date; ; day = addDays(day, -1)) {
        if (perfect.has(day)) run += 1;
        else if (!rest.has(day)) break;
    }
    return run;
};

// The run a day brought to an end: none if the day was perfect or had nothing due
export const runEndedBy = (days, summary) =>
    summary?.isPerfectDay || summary?.isRestDay ? 0 : runEndingOn(days, addDays(summary.date, -1));

// What a day's summary holds, as it is sent. xpNet is what the day added to the account, penalties taken off.
export const summaryOf = (log, xpLost = 0) => ({
    date: log.date,
    totalRoutines: log.totalRoutines,
    completedRoutines: log.completedRoutines,
    totalHabits: log.totalHabits,
    completedHabits: log.completedHabits,
    isPerfectDay: log.isPerfectDay,
    isRestDay: Boolean(log.isRestDay),
    xpNet: log.xpEarned,
    xpLost,
});

const routineFacts = (routine) => ({
    title: routine?.title ?? null,
    active: Boolean(routine?.isActive),
    startTime: routine?.startTime ?? "",
    endTime: routine?.endTime ?? "",
});

const habitFacts = (habit) => ({
    title: habit?.title ?? null,
    active: Boolean(habit?.isActive),
    timeOfDay: habit?.timeOfDay ?? "anytime",
    counted: habit?.habitType === "quantity",
    target: habit?.habitType === "quantity" ? habit.targetQuantity || 1 : 1,
    unit: habit?.unit ?? "",
});

/**
 * One ended day, item by item.
 * What was done comes from the completion logs, what was missed from the ledger. An item's name, hours and
 * target are the ones it has now (deleted items included): the logs do not keep them.
 * @param {Object} parts
 * @param {Array} parts.routineLogs - the day's RoutineLogs
 * @param {Array} parts.habitLogs - the day's HabitLogs
 * @param {Array} parts.penalties - the ledger entries charged for the day (missedEntriesIn)
 * @param {Map} parts.routines - id => Routine, for every routine those name
 * @param {Map} parts.habits - id => Habit, likewise
 * @returns {Array} - each { kind, id, title, active, status, ... }: status is "done", "late" (a routine done
 *   after its deadline), "partial" (a counted habit short of its target) or "missed"; xpEarned where it paid,
 *   xpLost where it cost
 */
export const itemsOfDay = ({ routineLogs, habitLogs, penalties, routines, habits }) => {
    const items = new Map();

    for (const log of routineLogs) {
        const id = log.routine.toString();
        items.set(`routine:${id}`, {
            kind: "routine",
            id,
            ...routineFacts(routines.get(id)),
            status: log.wasOnTime === false ? "late" : "done",
            completedAt: log.completedAt,
            xpEarned: log.xpEarned ?? 0,
        });
    }

    for (const log of habitLogs) {
        // A log that holds nothing (a count stepped back to zero) is not something that happened
        if (!log.completed && !(log.quantity > 0)) continue;

        const id = log.habit.toString();
        const habit = habits.get(id);
        items.set(`habit:${id}`, {
            kind: "habit",
            id,
            ...habitFacts(habit),
            status: log.completed ? "done" : "partial",
            quantity: log.quantity,
            // Logs from before the amount was kept on them paid what the habit is worth
            ...(log.completed ? { xpEarned: log.xpEarned ?? habit?.xpReward ?? 0 } : {}),
        });
    }

    for (const entry of penalties) {
        const kind = MISSED_REASONS[entry.reason];
        const id = itemIdOf(entry);
        const key = `${kind}:${id}`;
        const xpLost = -entry.amount;

        // A count that fell short was logged and charged: it stays "partial", and carries what it cost
        const logged = items.get(key);
        if (logged) {
            logged.xpLost = (logged.xpLost ?? 0) + xpLost;
            continue;
        }

        items.set(key, {
            kind,
            id,
            ...(kind === "routine"
                ? routineFacts(routines.get(id))
                : { ...habitFacts(habits.get(id)), quantity: 0 }),
            status: "missed",
            xpLost,
        });
    }

    return [...items.values()];
};

/**
 * How many things were left undone on a day that the list of items cannot name:
 * a miss that cost nothing left no entry in the ledger, and days from before misses were charged left none at all.
 */
export const unnamedMisses = (summary, items) => {
    if (!summary) return 0;

    const undone =
        summary.totalRoutines -
        summary.completedRoutines +
        (summary.totalHabits - summary.completedHabits);
    const named = items.filter((item) => item.status === "missed" || item.status === "partial").length;

    return Math.max(0, undone - named);
};
