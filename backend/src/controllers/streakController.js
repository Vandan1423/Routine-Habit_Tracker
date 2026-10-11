import User from "../models/User.js";
import DailyLog from "../models/DailyLog.js";
import XPLog from "../models/XPLog.js";
import Routine from "../models/Routine.js";
import Habit from "../models/Habit.js";
import { getPerfectDayBonus } from "../utils/dailyStreakCalculator.js";
import { addDays, getUserToday } from "../utils/dateRules.js";
import { missCost, readDay } from "../utils/dayPlan.js";
import {
    MISSED_REASONS,
    runEndedBy,
    streakDaysOf,
} from "../utils/dayHistory.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// How many ended days the recap looks back over: as many as a settlement can charge at once
const RECAP_DAYS = 7;

// @desc    Get overarching streak info and last 7 days of logs
// @route   GET /api/streaks/info
export const getStreakInfo = async (req, res, next) => {
    try {
        // Fetch only the specific streak fields to keep the payload tiny
        const user = await User.findById(req.user._id).select(
            "currentStreak bestStreak lastActiveDate",
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const today = getUserToday(req.user);

        const [recentLogs, todayBonus, day] = await Promise.all([
            // Fetch the 7 most recent daily logs, sorting newest first
            DailyLog.find({ user: req.user._id }).sort({ date: -1 }).limit(7),
            // The bonus for a day with everything done, which no single item's XP shows
            getPerfectDayBonus(
                req.user._id,
                today,
                new Date(Date.now() - 3 * DAY_MS),
            ),
            readDay(req.user, today),
        ]);

        // What was moved to Trash or retired today while it was still owed: no longer on the day's list,
        // but tonight still counts it as missed unless it is brought back and done.
        // archived: it was retired (it is in Archive), rather than deleted
        const owedOf = (kind, items, doneIds) =>
            items
                .filter((item) => !item.isActive && !doneIds.has(item._id.toString()))
                .map((item) => ({
                    kind,
                    id: item._id,
                    title: item.title,
                    xp: missCost(kind, item),
                    archived: Boolean(item.archivedAt) && !item.deletedAt,
                }));
        const owed = [
            ...owedOf("routine", day.routines, day.doneRoutineIds),
            ...owedOf("habit", day.habits, day.doneHabitIds),
        ];

        res.status(200).json({
            currentStreak: user.currentStreak || 0,
            bestStreak: user.bestStreak || 0,
            lastActiveDate: user.lastActiveDate || "",
            recentLogs,
            today,
            todayBonus: Math.max(todayBonus, 0),
            owed,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get historical daily logs for heatmap/analytics
// @route   GET /api/streaks/logs?days=30
export const getDailyLogs = async (req, res, next) => {
    try {
        // Default to 30 days if the query parameter isn't provided
        const limit = parseInt(req.query.days) || 30;

        const logs = await DailyLog.find({ user: req.user._id })
            .sort({ date: -1 }) // -1 sorts descending (newest first)
            .limit(limit);

        res.status(200).json({ logs });
    } catch (error) {
        next(error);
    }
};

// @desc    The days that ended recently: what was left undone on each, what that cost, and any streak it ended
// @route   GET /api/streaks/recap
export const getRecap = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const today = getUserToday(req.user);
        const oldest = addDays(today, -RECAP_DAYS);

        const [summaries, streakDays, penalties] = await Promise.all([
            DailyLog.find({
                user: userId,
                date: { $gte: oldest, $lt: today },
            }).sort({ date: -1 }),
            streakDaysOf(userId),
            // A day's penalties are written after it ends, so none of these can be older than the days themselves
            XPLog.find({
                user: userId,
                reason: { $in: Object.keys(MISSED_REASONS) },
                "metadata.date": { $gte: oldest, $lt: today },
                createdAt: {
                    $gte: new Date(Date.now() - (RECAP_DAYS + 2) * DAY_MS),
                },
            }).sort({ createdAt: 1 }),
        ]);

        // The ledger holds ids only. Names come from the items themselves, deleted ones included.
        const idsOf = (reason, field) =>
            penalties
                .filter((entry) => entry.reason === reason)
                .map((entry) => entry.metadata?.[field])
                .filter(Boolean);
        const [routines, habits] = await Promise.all([
            Routine.find({
                _id: { $in: idsOf("routine_missed", "routineId") },
                user: userId,
            }).select("title"),
            Habit.find({
                _id: { $in: idsOf("habit_missed", "habitId") },
                user: userId,
            }).select("title"),
        ]);
        const titles = new Map(
            [...routines, ...habits].map((item) => [
                item._id.toString(),
                item.title,
            ]),
        );

        const days = summaries.map((summary) => {
            const missed = penalties
                .filter((entry) => entry.metadata?.date === summary.date)
                .map((entry) => {
                    const kind = MISSED_REASONS[entry.reason];
                    const id = (
                        entry.metadata.routineId ?? entry.metadata.habitId
                    )?.toString();

                    return {
                        kind,
                        id,
                        title: titles.get(id) ?? null,
                        xpLost: -entry.amount,
                    };
                });

            return {
                date: summary.date,
                totalRoutines: summary.totalRoutines,
                completedRoutines: summary.completedRoutines,
                totalHabits: summary.totalHabits,
                completedHabits: summary.completedHabits,
                isPerfectDay: summary.isPerfectDay,
                isRestDay: Boolean(summary.isRestDay),
                xpEarned: summary.xpEarned,
                missed,
                xpLost: missed.reduce((sum, item) => sum + item.xpLost, 0),
                // A day with something left undone ends whatever run led up to it
                streakEnded: runEndedBy(streakDays, summary),
            };
        });

        res.status(200).json({ today, days });
    } catch (error) {
        next(error);
    }
};
