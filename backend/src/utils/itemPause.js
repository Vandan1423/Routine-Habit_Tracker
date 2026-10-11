import Routine from "../models/Routine.js";
import Habit from "../models/Habit.js";
import { updateDailyStreak } from "./dailyStreakCalculator.js";
import { addDays, getUserToday } from "./dateRules.js";

// Pausing a routine or a habit: for a stretch of days it is not due (a trip, an illness, exams).
// A paused day asks nothing, so it costs nothing and breaks no run, its own or the account's.
// The stretches are kept on the item (pauses), the past ones too, so its history always knows which days
// were off. Days spent in Archive are kept the same way once it is brought back (see itemArchive.js).

const MODELS = { routine: Routine, habit: Habit };

// The longest a single pause may be, and how far ahead one may start
export const MOST_PAUSE_DAYS = 365;

/**
 * The pauses with nothing left from `day` on: one that runs past it now ends the day before,
 * one that had not started by then is dropped. The days already gone stay as they were.
 * @param {Array} pauses - [{ from, until }]
 * @param {String} day - "YYYY-MM-DD"
 */
export const endPausesFrom = (pauses, day) =>
    (pauses ?? [])
        .map(({ from, until }) => ({ from, until }))
        .filter((pause) => pause.from < day)
        .map((pause) => (pause.until >= day ? { ...pause, until: addDays(day, -1) } : pause));

/**
 * The pause that covers today or is still to come, if any
 * @returns {Object|null} - { from, until }
 */
export const pauseAhead = (item, today) =>
    (item.pauses ?? []).find((pause) => pause.until >= today) ?? null;

/**
 * Pauses a routine or a habit for a number of days. It replaces whatever was left of a pause already set.
 * @param {Object} user - needs _id and timezone
 * @param {String} kind - "routine" or "habit"
 * @param {String} id
 * @param {Object} options - from: the first day off ("YYYY-MM-DD", today when left out); days: how many
 * @returns {Object|null} - null when the user has no such item in the plan; { refused } when it can't be
 *   paused; otherwise { item } as it now stands
 */
export const pauseItem = async (user, kind, id, { from, days }, now = new Date()) => {
    const model = MODELS[kind];
    const today = getUserToday(user, now);
    const start = from ?? today;

    if (start < today) return { refused: "A pause can’t start on a day that has passed." };
    if (start > addDays(today, MOST_PAUSE_DAYS)) {
        return { refused: "A pause can start at most a year from now." };
    }

    const item = await model.findOne({ _id: id, user: user._id, isActive: true });
    if (!item) return null;
    if (kind === "routine" && !item.isRecurring) {
        return { refused: "A one-off task can’t be paused. Move it to another day instead." };
    }

    const pauses = [...endPausesFrom(item.pauses, today), { from: start, until: addDays(start, days - 1) }];
    const saved = await model.findOneAndUpdate(
        { _id: id, user: user._id, isActive: true },
        { $set: { pauses } },
        { returnDocument: "after" },
    );
    if (!saved) return null;

    // Today may no longer ask for it
    await updateDailyStreak(user._id, today);
    return { item: saved };
};

/**
 * Ends a pause early: the item is due again from today. A pause that had not started yet is dropped.
 * @returns {Object|null} - null when the user has no such item in the plan; otherwise { item }
 */
export const resumeItem = async (user, kind, id, now = new Date()) => {
    const model = MODELS[kind];
    const today = getUserToday(user, now);

    const item = await model.findOne({ _id: id, user: user._id, isActive: true });
    if (!item) return null;

    const saved = await model.findOneAndUpdate(
        { _id: id, user: user._id, isActive: true },
        { $set: { pauses: endPausesFrom(item.pauses, today) } },
        { returnDocument: "after" },
    );
    if (!saved) return null;

    // Today may ask for it again
    await updateDailyStreak(user._id, today);
    return { item: saved };
};
