import DailyLog from "../models/DailyLog.js";

// DailyLog holds one summary row per user per day: what was due, what got done, and the XP that day netted.
// The counts and the day's standing are written by updateDailyStreak; this file holds the two small writes.

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
