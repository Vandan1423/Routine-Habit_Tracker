import HabitLog from "../models/HabitLog.js";

// Helper to generate local YYYY-MM-DD string to avoid UTC shift bugs
export const getLocalYYYYMMDD = (dateObj = new Date()) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const calculateStreak = async (habitId, userId) => {
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

    // 3. Set up our reference dates (Today and Yesterday)
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Normalize to midnight

    const todayStr = getLocalYYYYMMDD(currentDate);

    let checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getLocalYYYYMMDD(checkDate);

    // 4. If they haven't logged today AND haven't logged yesterday, the streak is dead
    if (!logMap.has(todayStr) && !logMap.has(yesterdayStr)) {
        return 0;
    }

    // 5. Figure out where to start counting
    let dateToProcess = new Date(currentDate);
    if (!logMap.has(todayStr)) {
        // If they haven't logged today yet, the streak is still alive from yesterday
        dateToProcess.setDate(dateToProcess.getDate() - 1);
    }

    // 6. Loop backwards in memory day-by-day
    while (true) {
        const checkStr = getLocalYYYYMMDD(dateToProcess);
        if (logMap.has(checkStr)) {
            streak++;
            dateToProcess.setDate(dateToProcess.getDate() - 1); // Go back one more day
        } else {
            // As soon as we hit a missing day, the streak breaks and we stop counting
            break;
        }
    }

    return streak;
};
