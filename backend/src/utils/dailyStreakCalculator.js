import Routine from '../models/Routine.js';
import RoutineLog from '../models/RoutineLog.js';
import DailyLog from '../models/DailyLog.js';
import User from '../models/User.js';
import { awardXP } from './rewardEngine.js';

// Helper to reliably construct YYYY-MM-DD from a Date object locally
const getLocalYYYYMMDD = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const updateDailyStreak = async (userId, dateString) => {
    try {
        // Parse the incoming date string (YYYY-MM-DD) safely
        const [y, m, d] = dateString.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const dayOfWeek = targetDate.getDay();

        // 1. Get all routines scheduled for this date
        const scheduledRoutines = await Routine.find({
            user: userId,
            isActive: true,
            $or: [
                { isRecurring: true, recurringDays: { $in: [dayOfWeek] } },
                { isRecurring: false, date: dateString }
            ]
        });
        const totalRoutines = scheduledRoutines.length;

        // 2. Get all RoutineLogs for this user on this date
        const routineLogs = await RoutineLog.find({ 
            user: userId, 
            date: dateString 
        });
        const completedRoutines = routineLogs.length;

        // 3 & 4. Calculate if it's a perfect day
        const isPerfectDay = totalRoutines > 0 && completedRoutines >= totalRoutines;

        // Check previous state to prevent double-awarding XP if they uncheck and re-check a task
        const existingDailyLog = await DailyLog.findOne({ user: userId, date: dateString });
        const wasAlreadyPerfect = existingDailyLog?.isPerfectDay || false;

        // 5. Calculate current perfect day streak (using the same robust memory-loop as habits)
        const perfectLogs = await DailyLog.find({ user: userId, isPerfectDay: true }).select('date');
        const perfectSet = new Set(perfectLogs.map(log => log.date));

        // Temporarily adjust the Set for TODAY'S current live calculation
        if (isPerfectDay) perfectSet.add(dateString);
        else perfectSet.delete(dateString);

        let currentStreak = 0;
        let checkDate = new Date(targetDate);
        const todayStr = getLocalYYYYMMDD(checkDate);
        
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayStr = getLocalYYYYMMDD(checkDate);

        // If today isn't perfect, and yesterday wasn't perfect, the streak is totally dead (0)
        if (perfectSet.has(todayStr) || perfectSet.has(yesterdayStr)) {
            let dateToProcess = new Date(targetDate);
            // If they haven't finished today yet, start counting from yesterday
            if (!perfectSet.has(todayStr)) {
                dateToProcess.setDate(dateToProcess.getDate() - 1);
            }
            
            // Loop backwards day-by-day counting the streak
            while (true) {
                const checkStr = getLocalYYYYMMDD(dateToProcess);
                if (perfectSet.has(checkStr)) {
                    currentStreak++;
                    dateToProcess.setDate(dateToProcess.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        // 8. Award Bonus XP (ONLY if they just hit Perfect Day status for the first time today)
        let bonusXP = 0;
        if (isPerfectDay && !wasAlreadyPerfect) {
            if (currentStreak >= 100) bonusXP = 200;
            else if (currentStreak >= 21) bonusXP = 100;
            else if (currentStreak >= 7) bonusXP = 50;
            else bonusXP = 20; // Streak 1-6 days

            await awardXP(userId, bonusXP, "perfect_day_bonus", {
                streakCount: currentStreak,
                date: dateString
            });
        }

        // Calculate total XP earned today by aggregating the XPLog
        // (Assuming you want to track this in the DailyLog)
        const totalXpEarnedToday = existingDailyLog ? (existingDailyLog.xpEarned + bonusXP) : bonusXP;

        // 6. Upsert the DailyLog for this date
        await DailyLog.findOneAndUpdate(
            { user: userId, date: dateString },
            { 
                totalRoutines, 
                completedRoutines, 
                isPerfectDay, 
                streakDay: currentStreak,
                $inc: { xpEarned: bonusXP } // Add bonus XP to whatever was already earned today
            },
            { upsert: true, new: true }
        );

        // 7. Update User's global streak stats
        const user = await User.findById(userId);
        user.currentStreak = currentStreak;
        if (currentStreak > (user.bestStreak || 0)) {
            user.bestStreak = currentStreak;
        }
        await user.save();

        // 9. Return gamification payload
        return { 
            isPerfectDay, 
            currentStreak, 
            bonusXP,
            justHitPerfectDay: (isPerfectDay && !wasAlreadyPerfect)
        };

    } catch (error) {
        console.error("Error updating daily streak:", error);
        throw error;
    }
};