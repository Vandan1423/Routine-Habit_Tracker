import User from "../models/User.js";
import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import DailyLog from "../models/DailyLog.js";
import { applyPenalty } from "./penaltyEngine.js";

/**
 * Runs at the end of the day to sweep the database and apply XP penalties
 * for any missed routines or habits from yesterday.
 */
export const processDailyPenalties = async () => {
    try {
        console.log("Starting daily penalty sweep...");

        // 1. Calculate yesterday's date string (YYYY-MM-DD) safely
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, "0");
        const day = String(yesterday.getDate()).padStart(2, "0");
        const yesterdayStr = `${year}-${month}-${day}`;
        const dayOfWeek = yesterday.getDay();

        // 2. Fetch all users
        const users = await User.find({});

        for (const user of users) {
            let totalXpLost = 0;

            // --- A. CHECK ROUTINES ---
            // Find all routines the user was supposed to do yesterday
            const scheduledRoutines = await Routine.find({
                user: user._id,
                isActive: true,
                $or: [
                    { isRecurring: true, recurringDays: { $in: [dayOfWeek] } },
                    { isRecurring: false, date: yesterdayStr },
                ],
            });

            // Find all routines they actually completed yesterday
            const routineLogs = await RoutineLog.find({
                user: user._id,
                date: yesterdayStr,
            });
            const completedRoutineIds = routineLogs.map((log) =>
                log.routine.toString(),
            );

            for (const routine of scheduledRoutines) {
                if (!completedRoutineIds.includes(routine._id.toString())) {
                    // Missed Routine Penalty!
                    const penalty = Math.floor((routine.xpReward || 0) / 2);
                    if (penalty > 0) {
                        await applyPenalty(
                            user._id,
                            penalty,
                            "routine_missed",
                            {
                                routineId: routine._id,
                                date: yesterdayStr,
                            },
                        );
                        totalXpLost += penalty;
                    }
                }
            }

            // --- B. CHECK HABITS ---
            // Assuming active habits are expected daily.
            // (If your habits have specific days, apply the same $or query used for routines above)
            const activeHabits = await Habit.find({ user: user._id });
            const habitLogs = await HabitLog.find({
                user: user._id,
                date: yesterdayStr,
            });

            for (const habit of activeHabits) {
                const log = habitLogs.find(
                    (l) => l.habit.toString() === habit._id.toString(),
                );

                // Missed Habit Penalty (No log exists, OR log exists but didn't reach target)
                if (!log || !log.completed) {
                    const penalty = Math.floor((habit.xpReward || 0) / 3);
                    if (penalty > 0) {
                        await applyPenalty(user._id, penalty, "habit_missed", {
                            habitId: habit._id,
                            date: yesterdayStr,
                        });
                        totalXpLost += penalty;
                    }
                }
            }

            // --- C. UPDATE DAILY LOG ---
            // Log the total penalty so we can show it on their dashboard/history
            if (totalXpLost > 0) {
                await DailyLog.findOneAndUpdate(
                    { user: user._id, date: yesterdayStr },
                    {
                        $set: { penaltiesProcessed: true }, // Safety flag to prevent double-running
                        $inc: { xpEarned: -totalXpLost }, // Reduce the net XP earned for that day
                    },
                    { upsert: true },
                );
            } else {
                // Mark as processed even if no penalties, to skip it next time
                await DailyLog.findOneAndUpdate(
                    { user: user._id, date: yesterdayStr },
                    { $set: { penaltiesProcessed: true } },
                    { upsert: true },
                );
            }
        }

        console.log(`Penalty sweep complete for ${yesterdayStr}!`);
    } catch (error) {
        console.error("Error processing daily penalties:", error);
    }
};
