import User from "../models/User.js";
import Habit from "../models/Habit.js";
import { applyPenalty } from "./penaltyEngine.js";
import { calculateStreak } from "./streakCalculator.js";
import { updateDailyStreak } from "./dailyStreakCalculator.js";
import { addDailyXp } from "./dailySummary.js";
import { missCost, readDay } from "./dayPlan.js";
import { addDays, getTodayIn, getUserToday, isPausedOn } from "./dateRules.js";

// However long someone stays away, at most this many of their most recent days are charged
const MAX_DAYS_CHARGED = 7;

// The timezone furthest ahead (UTC+14): nobody's calendar is later than this one
const EARLIEST_TIMEZONE = "Pacific/Kiritimati";

/**
 * Charges the XP penalties for one day that has ended, and completes that day's summary.
 */
const chargeMissedDay = async (user, day) => {
    // The day's totals, perfect-day status and its bonus, as they finally stood
    await updateDailyStreak(user._id, day);

    const { routines, habits, doneRoutineIds, doneHabitIds } = await readDay(user, day);
    let totalXpLost = 0;

    const charge = async (kind, item, reason, metadata) => {
        const penalty = missCost(kind, item);
        if (penalty <= 0) return;

        const { xpLost } = await applyPenalty(user._id, penalty, reason, metadata);
        totalXpLost += xpLost;
    };

    // --- A. ROUTINES that were due that day and never completed ---
    for (const routine of routines) {
        if (doneRoutineIds.has(routine._id.toString())) continue;
        await charge("routine", routine, "routine_missed", { routineId: routine._id, date: day });
    }

    // --- B. HABITS that were due that day and didn't reach their target ---
    for (const habit of habits) {
        if (doneHabitIds.has(habit._id.toString())) continue;
        await charge("habit", habit, "habit_missed", { habitId: habit._id, date: day });
    }

    // --- C. The day's net XP goes down by what was lost ---
    await addDailyXp(user._id, day, -totalXpLost);
};

/**
 * Streaks only move when something is completed, so a missed day leaves them showing a run
 * that has already ended. Once a day closes, bring them back in line with the user's new today.
 */
const refreshStreaks = async (user, today) => {
    await updateDailyStreak(user._id, today);

    const habits = await Habit.find({ user: user._id, isActive: true });
    for (const habit of habits) {
        const currentStreak = await calculateStreak(habit._id, user._id, today, (day) =>
            isPausedOn(habit, day),
        );
        if (currentStreak !== habit.currentStreak) {
            await Habit.updateOne({ _id: habit._id }, { currentStreak });
        }
    }
};

// Settlements running right now in this process, by user id
const settlementsInProgress = new Map();

const runSettlement = async (user, now) => {
    const today = getUserToday(user, now);
    const yesterday = addDays(today, -1);
    const settledThrough = user.penaltiesSettledThrough || "";

    // Claim the days before touching anything. Only one caller can move the marker from its old value,
    // so a request and the background sweep arriving together can't both charge the same day.
    const claim = await User.updateOne(
        {
            _id: user._id,
            penaltiesSettledThrough: settledThrough || { $in: ["", null] },
        },
        { $set: { penaltiesSettledThrough: yesterday } },
    );
    if (claim.modifiedCount === 0) {
        return;
    }
    user.penaltiesSettledThrough = yesterday;

    // An account with no marker predates this job (new accounts get one at sign-up).
    // It starts counting from today: nothing from before is charged.
    if (!settledThrough) {
        return;
    }

    // Start the day after the last settlement, but never further back than the cap
    const oldestChargeable = addDays(yesterday, -(MAX_DAYS_CHARGED - 1));
    let day = addDays(settledThrough, 1);
    if (day < oldestChargeable) day = oldestChargeable;

    for (; day <= yesterday; day = addDays(day, 1)) {
        await chargeMissedDay(user, day);
    }

    await refreshStreaks(user, today);
};

/**
 * Closes every day of a user's that has ended (at midnight in their timezone) since the last time:
 * missed routines and habits are charged, the day's summary is completed and streaks are refreshed.
 * Safe to call as often as needed and from several places at once: each day is charged exactly once.
 * @param {Object} user - needs _id, timezone and penaltiesSettledThrough
 */
export const settleEndedDays = async (user, now = new Date()) => {
    const userId = user._id.toString();

    if (!settlementsInProgress.has(userId)) {
        const yesterday = addDays(getUserToday(user, now), -1);
        if ((user.penaltiesSettledThrough || "") >= yesterday) {
            return; // No day has ended since the last settlement
        }

        settlementsInProgress.set(
            userId,
            runSettlement(user, now).finally(() =>
                settlementsInProgress.delete(userId),
            ),
        );
    }

    // Requests arriving while a settlement is running wait for it, so they answer with the settled numbers
    await settlementsInProgress.get(userId);
};

/**
 * Background sweep: settles every user whose day has ended, without waiting for them to open the app.
 * settleEndedDays also runs when a user makes a request, so a sweep that is missed
 * (the server was asleep) costs nothing: the user's next visit catches up.
 */
export const sweepEndedDays = async () => {
    try {
        // Anyone already settled through the furthest-ahead timezone's yesterday has nothing pending
        const latestYesterday = addDays(getTodayIn(EARLIEST_TIMEZONE), -1);

        const users = User.find({
            $or: [
                { penaltiesSettledThrough: { $lt: latestYesterday } },
                { penaltiesSettledThrough: null },
            ],
        })
            .select("timezone penaltiesSettledThrough")
            .cursor();

        for await (const user of users) {
            try {
                await settleEndedDays(user);
            } catch (error) {
                console.error(`Day settlement failed for user ${user._id}:`, error);
            }
        }
    } catch (error) {
        console.error("Error sweeping ended days:", error);
    }
};
