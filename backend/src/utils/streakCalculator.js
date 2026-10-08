import HabitLog from "../models/HabitLog.js";
import { addDays } from "./dateRules.js";

export const calculateStreak = async (habitId, userId, todayStr) => {
    // 1. Fetch ALL completed dates for this habit in a single, fast query
    // We use .select('date') so we only download the tiny string, not the whole document
    const logs = await HabitLog.find({
        habit: habitId,
        user: userId,
        completed: true,
    }).select("date");

    if (!logs || logs.length === 0) return 0;

    // 2. Put dates in a Set for instant O(1) lookups in memory
    const logMap = new Set(logs.map((log) => log.date));
    let streak = 0;

    // 3. Set up our reference dates (Today and Yesterday, in the user's timezone)
    const yesterdayStr = addDays(todayStr, -1);

    // 4. If they haven't logged today AND haven't logged yesterday, the streak is dead
    if (!logMap.has(todayStr) && !logMap.has(yesterdayStr)) {
        return 0;
    }

    // 5. Figure out where to start counting
    // If they haven't logged today yet, the streak is still alive from yesterday
    let checkStr = logMap.has(todayStr) ? todayStr : yesterdayStr;

    // 6. Loop backwards in memory day-by-day
    while (true) {
        if (logMap.has(checkStr)) {
            streak++;
            checkStr = addDays(checkStr, -1); // Go back one more day
        } else {
            // As soon as we hit a missing day, the streak breaks and we stop counting
            break;
        }
    }

    return streak;
};
