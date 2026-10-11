import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import {
    DEFAULT_TIMEZONE,
    existedOn,
    getTodayIn,
    getWeekday,
    isHabitScheduledOn,
    isRoutineScheduledOn,
} from "./dateRules.js";

// What a day asked of its owner: the routines and habits that were due on it, and which of them got done.
// The day's summary, the account's run and the night's charges are all worked out from this one reading.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True if a routine or habit counts on that day.
 * One that is in the plan counts from the day it was made. One that has left it (deleted to Trash, or retired
 * to Archive) counts on a single day: the day it left, and only if it was made before that day. So deleting or
 * retiring something that is still owed is not a way out of a miss, while something made by mistake can be
 * deleted the same day at no cost. One retired first and deleted later left on the day it was retired.
 * Whether it was due at all that day (its weekdays, a pause) is the schedule's to say: see dateRules.js.
 */
export const countsOn = (item, day, timezone) => {
    const zone = timezone || DEFAULT_TIMEZONE;

    if (!existedOn(item, day, zone)) return false;
    if (item.isActive) return true;

    const leftAt = item.archivedAt ?? item.deletedAt;
    return (
        Boolean(leftAt) &&
        getTodayIn(zone, leftAt) === day &&
        getTodayIn(zone, item.createdAt) < day
    );
};

// In the plan, or deleted or retired near enough to the day that it may still count on it (countsOn decides)
const mayCountOn = (day) => {
    const since = new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS);

    return {
        $or: [{ isActive: true }, { deletedAt: { $gte: since } }, { archivedAt: { $gte: since } }],
    };
};

/**
 * Reads one day.
 * @param {Object} user - needs _id and timezone
 * @param {String} day - "YYYY-MM-DD"
 * @returns {Object} - routines and habits: the ones due that day; doneRoutineIds and doneHabitIds:
 *   the ids, as text, of everything completed that day (due or not)
 */
export const readDay = async (user, day) => {
    const [routines, routineLogs, habits, habitLogs] = await Promise.all([
        Routine.find({
            user: user._id,
            $and: [
                mayCountOn(day),
                {
                    $or: [
                        { isRecurring: true, recurringDays: getWeekday(day) },
                        { isRecurring: false, date: day },
                    ],
                },
            ],
        }),
        RoutineLog.find({ user: user._id, date: day }).select("routine"),
        Habit.find({ user: user._id, ...mayCountOn(day) }),
        HabitLog.find({ user: user._id, date: day, completed: true }).select("habit"),
    ]);

    return {
        // The query found the ones that fall on the day; a pause can still have taken it off
        routines: routines.filter(
            (routine) => countsOn(routine, day, user.timezone) && isRoutineScheduledOn(routine, day),
        ),
        habits: habits.filter(
            (habit) => countsOn(habit, day, user.timezone) && isHabitScheduledOn(habit, day),
        ),
        doneRoutineIds: new Set(routineLogs.map((log) => log.routine.toString())),
        doneHabitIds: new Set(habitLogs.map((log) => log.habit.toString())),
    };
};

// How much of what was due got done
export const totalsOf = ({ routines, habits, doneRoutineIds, doneHabitIds }) => ({
    totalRoutines: routines.length,
    completedRoutines: routines.filter((routine) => doneRoutineIds.has(routine._id.toString())).length,
    totalHabits: habits.length,
    completedHabits: habits.filter((habit) => doneHabitIds.has(habit._id.toString())).length,
});

// What leaving it undone costs: half of what a routine is worth, a third of what a habit is
export const missCost = (kind, item) =>
    Math.floor((item.xpReward || 0) / (kind === "routine" ? 2 : 3));
