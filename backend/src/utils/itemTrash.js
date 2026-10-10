import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { awardXP } from "./rewardEngine.js";
import { updateDailyStreak } from "./dailyStreakCalculator.js";
import { getUserToday, isHabitScheduledOn, isRoutineScheduledOn } from "./dateRules.js";
import { countsOn, missCost } from "./dayPlan.js";
import { OUT_OF_TRASH, trashStamp } from "./trash.js";

// Moving a routine or a habit to Trash, and bringing it back.
// Its XP stays: everything its completions earned is the account's, so replacing a routine after a month of
// following it costs nothing. Deleting only ends the item from now on (today still counts if it was owed,
// see countsOn). Charges for days it was missed are not refunded either.
// Items deleted while the old rule held their XP in Trash (xpHeld): recovering one still pays that back.

const KINDS = {
    routine: {
        model: Routine,
        idField: "routineId",
        isDueOn: isRoutineScheduledOn,
        doneOn: (routine, date) => RoutineLog.exists({ routine: routine._id, date }),
    },
    habit: {
        model: Habit,
        idField: "habitId",
        isDueOn: isHabitScheduledOn,
        doneOn: (habit, date) => HabitLog.exists({ habit: habit._id, date, completed: true }),
    },
};

// Matches a routine or habit that is in Trash and can still be recovered
export const ITEM_IN_TRASH = { isActive: false, deletedAt: { $ne: null }, purgedAt: null };

/**
 * Moves a routine or a habit to Trash.
 * @param {Object} user - needs _id, timezone and trashDays
 * @param {String} kind - "routine" or "habit"
 * @param {String} id
 * @returns {Object|null} - null when the user has no such item in their plan. Otherwise item: as it now stands;
 *   xpTaken: always 0, no XP leaves with an item; owed: what tonight still charges for it, or 0
 */
export const moveItemToTrash = async (user, kind, id, now = new Date()) => {
    const { model, isDueOn, doneOn } = KINDS[kind];

    // Claimed in one step, so two requests arriving together can't both move it
    const item = await model.findOneAndUpdate(
        { _id: id, user: user._id, isActive: true },
        { $set: { isActive: false, ...trashStamp(user, now) } },
        { returnDocument: "after" },
    );
    if (!item) return null;

    // Today no longer asks for it, unless it was owed (see countsOn)
    const today = getUserToday(user, now);
    await updateDailyStreak(user._id, today);

    const stillOwed =
        countsOn(item, today, user.timezone) &&
        isDueOn(item, today) &&
        !(await doneOn(item, today));

    return { item, xpTaken: 0, owed: stillOwed ? missCost(kind, item) : 0 };
};

/**
 * Brings a routine or a habit back from Trash exactly as it was, with any XP an older delete held back.
 * @returns {Object|null} - null when the user has no such item in Trash. Otherwise item, and xpReturned
 */
export const restoreItemFromTrash = async (user, kind, id, now = new Date()) => {
    const { model, idField } = KINDS[kind];

    // The copy from before the change still says how much XP was held
    const before = await model.findOneAndUpdate(
        { _id: id, user: user._id, ...ITEM_IN_TRASH },
        { $set: { isActive: true, xpHeld: 0, ...OUT_OF_TRASH } },
        { returnDocument: "before" },
    );
    if (!before) return null;

    const xpReturned = before.xpHeld || 0;
    if (xpReturned > 0) {
        await awardXP(user._id, xpReturned, "item_restored", {
            [idField]: before._id,
            title: before.title,
        });
    }

    // It is part of today again if today is one of its days
    await updateDailyStreak(user._id, getUserToday(user, now));

    return { item: await model.findById(before._id), xpReturned };
};
