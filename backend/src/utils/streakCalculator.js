import HabitLog from "../models/HabitLog.js";
import { addDays } from "./dateRules.js";

// A habit's streak: how many days in a row it has been done.
// isPaused (optional) says whether a day was off (see dateRules.isPausedOn): a day off is stepped over,
// so a pause neither adds to a streak nor ends it.

export const calculateStreak = async (habitId, userId, todayStr, isPaused = null) => {
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
    const earliest = logs.reduce((first, log) => (log.date < first ? log.date : first), todayStr);
    let streak = 0;

    // 3. Figure out where to start counting
    // If they haven't logged today yet, the streak is still alive from yesterday
    let checkStr = logMap.has(todayStr) ? todayStr : addDays(todayStr, -1);

    // 4. Loop backwards in memory day-by-day. As soon as we hit a day that was neither done nor off,
    // the streak breaks and we stop counting. Nothing before the first log can add to it.
    while (checkStr >= earliest) {
        if (logMap.has(checkStr)) {
            streak++;
        } else if (!isPaused?.(checkStr)) {
            break;
        }
        checkStr = addDays(checkStr, -1); // Go back one more day
    }

    return streak;
};

// True if every day strictly between two dates was off, so a run carries across the gap
const bridged = (from, to, isPaused) => {
    if (addDays(from, 1) === to) return true;
    if (!isPaused) return false;

    for (let day = addDays(from, 1); day < to; day = addDays(day, 1)) {
        if (!isPaused(day)) return false;
    }
    return true;
};

// The longest run of consecutive completed days a habit has ever had
export const calculateBestStreak = async (habitId, userId, isPaused = null) => {
    const logs = await HabitLog.find({
        habit: habitId,
        user: userId,
        completed: true,
    })
        .select("date")
        .sort({ date: 1 });

    let best = 0;
    let run = 0;
    let previous = null;

    for (const { date } of logs) {
        run = previous && bridged(previous, date, isPaused) ? run + 1 : 1;
        if (run > best) best = run;
        previous = date;
    }

    return best;
};
