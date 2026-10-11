import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { updateDailyStreak } from "./dailyStreakCalculator.js";
import {
    addDays,
    DEFAULT_TIMEZONE,
    getTodayIn,
    getUserToday,
    isHabitScheduledOn,
    isRoutineScheduledOn,
} from "./dateRules.js";
import { countsOn, missCost } from "./dayPlan.js";
import { endPausesFrom } from "./itemPause.js";

// Archive: where a routine or habit goes when it is retired rather than deleted. It leaves the plan, so no
// day asks for it any more, but nothing of it is let go of: its history, its runs and the XP it earned all
// stay, and it can be brought back whenever it is wanted again. Nothing in Archive ever expires.
//
// Retiring follows the rule deleting does (see countsOn): it ends the item from now on, but today still
// counts it if it was due and not yet done, so retiring is not a way out of a miss.

const KINDS = {
    routine: {
        model: Routine,
        isDueOn: isRoutineScheduledOn,
        doneOn: (routine, date) => RoutineLog.exists({ routine: routine._id, date }),
    },
    habit: {
        model: Habit,
        isDueOn: isHabitScheduledOn,
        doneOn: (habit, date) => HabitLog.exists({ habit: habit._id, date, completed: true }),
    },
};

// Matches a routine or habit that is in Archive (and not in Trash)
export const ITEM_IN_ARCHIVE = { isActive: false, archivedAt: { $ne: null }, deletedAt: null };

// Matches a routine or habit whose page can still be looked at: one in the plan, or one in Archive
export const ITEM_IN_PLAN_OR_ARCHIVE = {
    deletedAt: null,
    $or: [{ isActive: true }, { archivedAt: { $ne: null } }],
};

// The day an item was retired, in the user's own calendar, or null for one that is not in Archive
export const archivedDayOf = (item, timezone) =>
    item.archivedAt ? getTodayIn(timezone || DEFAULT_TIMEZONE, item.archivedAt) : null;

/**
 * Retires a routine or a habit: out of the plan and into Archive.
 * @param {Object} user - needs _id and timezone
 * @param {String} kind - "routine" or "habit"
 * @returns {Object|null} - null when the user has no such item in the plan; { refused } when it can't be
 *   retired; otherwise item: as it now stands, and owed: what tonight still charges for it, or 0
 */
export const archiveItem = async (user, kind, id, now = new Date()) => {
    const { model, isDueOn, doneOn } = KINDS[kind];
    const today = getUserToday(user, now);

    const found = await model.findOne({ _id: id, user: user._id, isActive: true });
    if (!found) return null;
    if (kind === "routine" && !found.isRecurring) {
        return { refused: "A one-off task can’t be retired. Delete it instead." };
    }

    // Claimed in one step, so two requests arriving together can't both retire it.
    // A pause that was still to come no longer applies; today's, if it has one, stays.
    const item = await model.findOneAndUpdate(
        { _id: id, user: user._id, isActive: true },
        {
            $set: {
                isActive: false,
                archivedAt: now,
                pauses: endPausesFrom(found.pauses, addDays(today, 1)),
            },
        },
        { returnDocument: "after" },
    );
    if (!item) return null;

    // Today no longer asks for it, unless it was owed (see countsOn)
    await updateDailyStreak(user._id, today);

    const stillOwed =
        countsOn(item, today, user.timezone) &&
        isDueOn(item, today) &&
        !(await doneOn(item, today));

    return { item, owed: stillOwed ? missCost(kind, item) : 0 };
};

/**
 * Brings a routine or a habit back from Archive into the plan, due again from today.
 * The days it spent in Archive are kept as a pause, so its history shows them as days off.
 * Days that ended while it was away have already been closed without it (the routes settle before this runs).
 * @returns {Object|null} - null when the user has no such item in Archive; otherwise { item }
 */
export const unarchiveItem = async (user, kind, id, now = new Date()) => {
    const { model } = KINDS[kind];
    const today = getUserToday(user, now);

    const before = await model.findOneAndUpdate(
        { _id: id, user: user._id, ...ITEM_IN_ARCHIVE },
        { $set: { isActive: true, archivedAt: null } },
        { returnDocument: "before" },
    );
    if (!before) return null;

    // The day it was retired still counted; the days after it, up to yesterday, were off
    const away = {
        from: addDays(archivedDayOf(before, user.timezone), 1),
        until: addDays(today, -1),
    };
    if (away.from <= away.until) {
        await model.updateOne({ _id: before._id }, { $push: { pauses: away } });
    }

    // It is part of today again if today is one of its days
    await updateDailyStreak(user._id, today);

    return { item: await model.findById(before._id) };
};
