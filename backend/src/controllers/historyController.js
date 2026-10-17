import DailyLog from "../models/DailyLog.js";
import XPLog from "../models/XPLog.js";
import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { getPerfectDayBonus } from "../utils/dailyStreakCalculator.js";
import {
    addDays,
    DEFAULT_TIMEZONE,
    getTodayIn,
    getUserToday,
} from "../utils/dateRules.js";
import {
    itemIdOf,
    itemsOfDay,
    lossByDay,
    MISSED_REASONS,
    missedEntriesIn,
    runEndedBy,
    runEndingOn,
    streakDaysOf,
    summaryOf,
    unnamedMisses,
} from "../utils/dayHistory.js";

// Everything here only reads. Days that have ended are closed by the settlement before any of it runs.

// How many ledger entries a page holds unless asked otherwise
const LEDGER_PAGE = 30;

// The first day the account has a summary for, or null for an account with none yet
const firstDayOf = async (userId) =>
    (await DailyLog.findOne({ user: userId }).sort({ date: 1 }).select("date"))?.date ?? null;

/**
 * The routines and habits a set of ids names, deleted ones included, as two maps of id => item.
 * Asking with the owner as well means an id that belongs to someone else names nothing.
 */
const itemsNamed = async (userId, routineRefs, habitRefs) => {
    // The ledger's metadata is free-form: anything that is not an id names nothing
    const idsOf = (refs) => [...new Set(refs.map(String))].filter((id) => /^[0-9a-f]{24}$/i.test(id));
    const routineIds = idsOf(routineRefs);
    const habitIds = idsOf(habitRefs);

    const [routines, habits] = await Promise.all([
        routineIds.length
            ? Routine.find({ _id: { $in: routineIds }, user: userId }).select(
                  "title startTime endTime isActive xpReward",
              )
            : [],
        habitIds.length
            ? Habit.find({ _id: { $in: habitIds }, user: userId }).select(
                  "title timeOfDay habitType targetQuantity unit isActive xpReward",
              )
            : [],
    ]);
    const byId = (list) => new Map(list.map((item) => [item._id.toString(), item]));

    return { routines: byId(routines), habits: byId(habits) };
};

const idsIn = (penalties, reason) =>
    penalties.filter((entry) => entry.reason === reason).map(itemIdOf).filter(Boolean);

// @desc    The summary of each day from one date to another: what was due, what got done, what it netted and lost
// @route   GET /api/history/days?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getDays = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { from, to } = req.query;

        const [summaries, penalties, since] = await Promise.all([
            DailyLog.find({ user: userId, date: { $gte: from, $lte: to } }).sort({ date: 1 }),
            missedEntriesIn(userId, from, to),
            firstDayOf(userId),
        ]);
        const lost = lossByDay(penalties);

        res.status(200).json({
            today: getUserToday(req.user),
            since,
            // Oldest first. A day with nothing due and nothing done has no summary, and is not listed.
            days: summaries.map((summary) => summaryOf(summary, lost.get(summary.date) ?? 0)),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    One day that has ended, item by item: what was done and when, what was missed and what it cost
// @route   GET /api/history/days/:date
export const getDay = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { date } = req.params;
        const today = getUserToday(req.user);

        // Today is still open, and is shown by the routes that can change it
        if (date >= today) {
            return res.status(400).json({ message: "Only a day that has ended can be looked back on." });
        }

        const [summary, routineLogs, habitLogs, penalties, bonus, streakDays, since] = await Promise.all([
            DailyLog.findOne({ user: userId, date }),
            RoutineLog.find({ user: userId, date }),
            HabitLog.find({ user: userId, date }),
            missedEntriesIn(userId, date, date),
            getPerfectDayBonus(userId, date),
            streakDaysOf(userId),
            firstDayOf(userId),
        ]);

        const named = await itemsNamed(
            userId,
            [...routineLogs.map((log) => log.routine), ...idsIn(penalties, "routine_missed")],
            [...habitLogs.map((log) => log.habit), ...idsIn(penalties, "habit_missed")],
        );
        const items = itemsOfDay({ routineLogs, habitLogs, penalties, ...named });
        const xpLost = lossByDay(penalties).get(date) ?? 0;
        const perfect = Boolean(summary?.isPerfectDay);

        res.status(200).json({
            today,
            since,
            date,
            // null for a day nothing was due on and nothing was done on
            summary: summary ? summaryOf(summary, xpLost) : null,
            items,
            unnamed: unnamedMisses(summary, items),
            bonus: Math.max(bonus, 0),
            xpLost,
            // The run of days with everything done that this day belonged to, or brought to an end
            run: perfect ? runEndingOn(streakDays, date) : 0,
            streakEnded: summary ? runEndedBy(streakDays, summary) : runEndingOn(streakDays, addDays(date, -1)),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Each routine and habit over a stretch of days: how often it was done, done late and missed
// @route   GET /api/history/items?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getItems = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { from, to } = req.query;
        const range = { $gte: from, $lte: to };

        const [routineLogs, habitLogs, penalties] = await Promise.all([
            RoutineLog.find({ user: userId, date: range }).select("routine wasOnTime xpEarned"),
            HabitLog.find({ user: userId, date: range, completed: true }).select("habit xpEarned"),
            missedEntriesIn(userId, from, to),
        ]);

        const named = await itemsNamed(
            userId,
            [...routineLogs.map((log) => log.routine), ...idsIn(penalties, "routine_missed")],
            [...habitLogs.map((log) => log.habit), ...idsIn(penalties, "habit_missed")],
        );

        const tallies = new Map();
        const tallyOf = (kind, id) => {
            const key = `${kind}:${id}`;
            if (!tallies.has(key)) {
                const item = (kind === "routine" ? named.routines : named.habits).get(id);
                tallies.set(key, {
                    kind,
                    id,
                    title: item?.title ?? null,
                    active: Boolean(item?.isActive),
                    done: 0,
                    late: 0,
                    missed: 0,
                    xpEarned: 0,
                    xpLost: 0,
                });
            }
            return tallies.get(key);
        };

        for (const log of routineLogs) {
            const tally = tallyOf("routine", log.routine.toString());
            tally.done += 1;
            if (log.wasOnTime === false) tally.late += 1;
            tally.xpEarned += log.xpEarned ?? 0;
        }
        for (const log of habitLogs) {
            const id = log.habit.toString();
            const tally = tallyOf("habit", id);
            tally.done += 1;
            // Logs from before the amount was kept on them paid what the habit is worth
            tally.xpEarned += log.xpEarned ?? named.habits.get(id)?.xpReward ?? 0;
        }
        // A day charged as missed is a day it was due and not done, whatever its schedule says now
        for (const entry of penalties) {
            const id = itemIdOf(entry);
            if (!id) continue;

            const tally = tallyOf(MISSED_REASONS[entry.reason], id);
            tally.missed += 1;
            tally.xpLost -= entry.amount;
        }

        res.status(200).json({
            today: getUserToday(req.user),
            from,
            to,
            items: [...tallies.values()],
        });
    } catch (error) {
        next(error);
    }
};

// @desc    How each routine and habit stood on each day of a stretch: done, done late, partly done or missed.
//          A day it was not due on, or that has nothing on record for it, is left out.
// @route   GET /api/history/marks?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getMarks = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { from, to } = req.query;
        const range = { $gte: from, $lte: to };

        const [routineLogs, habitLogs, penalties] = await Promise.all([
            RoutineLog.find({ user: userId, date: range }).select("routine date wasOnTime"),
            HabitLog.find({ user: userId, date: range }).select("habit date completed quantity"),
            missedEntriesIn(userId, from, to),
        ]);

        const marks = new Map();
        const mark = (date, kind, id, fields) => {
            const key = `${date}|${kind}|${id}`;
            if (!marks.has(key)) marks.set(key, { date, kind, id, ...fields });
        };

        for (const log of routineLogs) {
            mark(log.date, "routine", log.routine.toString(), { status: log.wasOnTime === false ? "late" : "done" });
        }
        for (const log of habitLogs) {
            if (log.completed) mark(log.date, "habit", log.habit.toString(), { status: "done" });
            // Counted, and short of the target
            else if ((log.quantity ?? 0) > 0) {
                mark(log.date, "habit", log.habit.toString(), { status: "partial", quantity: log.quantity });
            }
        }
        // A day charged as missed, with nothing done on it at all. Something logged for it is what happened.
        for (const entry of penalties) {
            const id = itemIdOf(entry);
            if (id) mark(entry.metadata.date, MISSED_REASONS[entry.reason], id, { status: "missed" });
        }

        res.status(200).json({
            today: getUserToday(req.user),
            from,
            to,
            marks: [...marks.values()].sort((a, b) => a.date.localeCompare(b.date)),
        });
    } catch (error) {
        next(error);
    }
};

const cursorOf = (entry) => `${entry.createdAt.getTime()}_${entry._id}`;

// @desc    The XP ledger, newest first, a page at a time: every gain and loss, with the item it was for
// @route   GET /api/history/ledger?before=<cursor>&limit=30
export const getLedger = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const limit = Number(req.query.limit) || LEDGER_PAGE;
        const filter = { user: userId };

        if (req.query.before) {
            const [moment, id] = req.query.before.split("_");
            const at = new Date(Number(moment));

            // Entries written in the same instant are told apart by their ids
            filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }];
        }

        // One more than asked for, to know whether anything older is left
        const found = await XPLog.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1);
        const page = found.slice(0, limit);

        const idsOf = (field) =>
            page.map((entry) => entry.metadata?.[field]?.toString()).filter(Boolean);
        const named = await itemsNamed(userId, idsOf("routineId"), idsOf("habitId"));
        const timezone = req.user.timezone || DEFAULT_TIMEZONE;

        res.status(200).json({
            today: getUserToday(req.user),
            entries: page.map((entry) => {
                const metadata = entry.metadata ?? {};
                const kind = metadata.routineId ? "routine" : metadata.habitId ? "habit" : null;
                const id = itemIdOf(entry);
                const item = kind && (kind === "routine" ? named.routines : named.habits).get(id);

                return {
                    id: entry._id,
                    at: entry.createdAt,
                    // The day it belongs to: a penalty is written the morning after the day it is for
                    date: metadata.date ?? getTodayIn(timezone, entry.createdAt),
                    amount: entry.amount,
                    reason: entry.reason,
                    kind,
                    itemId: id,
                    title: item?.title ?? metadata.habitTitle ?? null,
                    active: Boolean(item?.isActive),
                    late: metadata.wasOnTime === false,
                    ...(metadata.streakCount ? { streak: metadata.streakCount } : {}),
                };
            }),
            // What to send as `before` for the next page, or null when this was the last
            next: found.length > limit ? cursorOf(page.at(-1)) : null,
        });
    } catch (error) {
        next(error);
    }
};
