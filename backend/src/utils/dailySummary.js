import DailyLog from "../models/DailyLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { existedOn, isHabitScheduledOn } from "./dateRules.js";

// DailyLog holds one summary row per user per day: what was due, what got done, and the XP that day netted.

/**
 * Creates or updates a day's summary row.
 * Two requests creating the same row at once collide on its unique index; the loser simply retries as an update.
 */
export const upsertDailyLog = async (userId, date, update) => {
    const run = () =>
        DailyLog.findOneAndUpdate({ user: userId, date }, update, {
            upsert: true,
            returnDocument: "after",
        });

    try {
        return await run();
    } catch (error) {
        if (error.code !== 11000) throw error;
        return run();
    }
};

// Adds to the XP a day netted. A negative amount takes away (an undone completion, a penalty).
export const addDailyXp = async (userId, date, amount) => {
    if (amount) {
        await upsertDailyLog(userId, date, { $inc: { xpEarned: amount } });
    }
};

/**
 * Records how many of the habits due on a day were completed.
 * @param {Object} user - needs _id and timezone
 * @param {String} date - "YYYY-MM-DD"
 * @returns {Object} - The habits that were due and the ids of those completed
 */
export const syncHabitTotals = async (user, date) => {
    const [habits, completedLogs] = await Promise.all([
        Habit.find({ user: user._id, isActive: true }),
        HabitLog.find({ user: user._id, date, completed: true }).select("habit"),
    ]);

    const dueHabits = habits.filter(
        (habit) =>
            existedOn(habit, date, user.timezone) &&
            isHabitScheduledOn(habit, date),
    );
    const completedIds = new Set(
        completedLogs.map((log) => log.habit.toString()),
    );

    await upsertDailyLog(user._id, date, {
        $set: {
            totalHabits: dueHabits.length,
            completedHabits: dueHabits.filter((habit) =>
                completedIds.has(habit._id.toString()),
            ).length,
        },
    });

    return { dueHabits, completedIds };
};
