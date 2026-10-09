import DailyLog from "../models/DailyLog.js";
import User from "../models/User.js";
import XPLog from "../models/XPLog.js";
import { awardXP, revokeXP } from "./rewardEngine.js";
import { addDays, getUserToday } from "./dateRules.js";
import { upsertDailyLog } from "./dailySummary.js";
import { readDay, totalsOf } from "./dayPlan.js";
import { runEndingOn, streakDaysOf } from "./dayHistory.js";

const BONUS_REASONS = ["perfect_day_bonus", "perfect_day_bonus_revoked"];

/**
 * The perfect-day bonus a date holds right now: what was awarded for it, less what was taken back.
 * @param {String} userId - The database ID of the user
 * @param {String} dateString - "YYYY-MM-DD"
 * @param {Date} [createdSince] - only look at ledger entries written since then (a bonus is written on its own day)
 */
export const getPerfectDayBonus = async (userId, dateString, createdSince) => {
    const bonusLogs = await XPLog.find({
        user: userId,
        reason: { $in: BONUS_REASONS },
        "metadata.date": dateString,
        ...(createdSince ? { createdAt: { $gte: createdSince } } : {}),
    }).select("amount");

    return bonusLogs.reduce((sum, log) => sum + log.amount, 0);
};

// What a day with everything done pays, by how long the run has lasted
const bonusFor = (streak) => {
    if (streak >= 100) return 200;
    if (streak >= 21) return 100;
    if (streak >= 7) return 50;
    return 20;
};

/**
 * Brings a day's summary up to date with what was due on it and what got done, and with it the account's run.
 *
 * A day is perfect when something was due and every routine and habit due was done. A perfect day adds to the
 * run and pays a bonus, once. A day with nothing due is a rest day: it neither adds to the run nor ends it.
 * Any other day ends the run once it has closed; while it is still open it has not ended anything yet.
 * @param {String} userId - The database ID of the user
 * @param {String} dateString - "YYYY-MM-DD", today or a day that has just ended
 */
export const updateDailyStreak = async (userId, dateString) => {
    try {
        const owner = await User.findById(userId).select("timezone");
        const user = { _id: userId, timezone: owner?.timezone };

        // 1. What the day asked for and what got done
        const totals = totalsOf(await readDay(user, dateString));
        const due = totals.totalRoutines + totals.totalHabits;
        const isRestDay = due === 0;
        const isPerfectDay =
            due > 0 &&
            totals.completedRoutines === totals.totalRoutines &&
            totals.completedHabits === totals.totalHabits;

        // Check previous state to prevent double-awarding XP if they uncheck and re-check a task
        const existingDailyLog = await DailyLog.findOne({ user: userId, date: dateString });
        const wasAlreadyPerfect = existingDailyLog?.isPerfectDay || false;

        // 2. The run, with this day as it stands now
        const days = await streakDaysOf(userId);
        days.perfect.delete(dateString);
        days.rest.delete(dateString);
        if (isPerfectDay) days.perfect.add(dateString);
        if (isRestDay) days.rest.add(dateString);

        let currentStreak;
        if (isPerfectDay || isRestDay) {
            currentStreak = runEndingOn(days, dateString);
        } else if (dateString < getUserToday(user)) {
            currentStreak = 0; // The day closed with something left undone
        } else {
            currentStreak = runEndingOn(days, addDays(dateString, -1)); // Still open: the run stands as it did last night
        }

        // 3. The bonus, only when the day has just become perfect
        let bonusXP = 0;
        if (isPerfectDay && !wasAlreadyPerfect) {
            bonusXP = bonusFor(currentStreak);

            await awardXP(userId, bonusXP, "perfect_day_bonus", {
                streakCount: currentStreak,
                date: dateString,
            });
        } else if (!isPerfectDay && wasAlreadyPerfect) {
            // The day stopped being perfect (a completion was undone, or something new became due):
            // take back whatever bonus this date still holds, so finishing it again can't earn the bonus twice
            const bonusHeld = await getPerfectDayBonus(userId, dateString);

            if (bonusHeld > 0) {
                const { xpRevoked } = await revokeXP(userId, bonusHeld, "perfect_day_bonus_revoked", {
                    date: dateString,
                });
                bonusXP = -xpRevoked;
            }
        }

        // 4. The day's summary
        await upsertDailyLog(userId, dateString, {
            ...totals,
            isPerfectDay,
            isRestDay,
            streakDay: currentStreak,
            $inc: { xpEarned: bonusXP }, // Add bonus XP to whatever was already earned that day
        });

        // 5. The account's own counters
        await User.updateOne(
            { _id: userId },
            { $set: { currentStreak }, $max: { bestStreak: currentStreak } },
        );

        return {
            isPerfectDay,
            currentStreak,
            bonusXP,
            justHitPerfectDay: isPerfectDay && !wasAlreadyPerfect,
        };
    } catch (error) {
        console.error("Error updating daily streak:", error);
        throw error;
    }
};
