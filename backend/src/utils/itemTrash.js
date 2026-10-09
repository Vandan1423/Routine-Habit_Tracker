import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { awardXP, revokeXP } from "./rewardEngine.js";
import { updateDailyStreak } from "./dailyStreakCalculator.js";
import { getUserToday, isHabitScheduledOn, isRoutineScheduledOn } from "./dateRules.js";
import { countsOn, missCost } from "./dayPlan.js";
import { OUT_OF_TRASH, trashStamp } from "./trash.js";

// Moving a routine or a habit to Trash, and bringing it back.
// Its XP goes with it: everything its completions ever earned leaves the account while it is in Trash,
// comes back if it is recovered, and stays gone if Trash lets go of it. Charges for days it was missed
// are not part of this: they were the cost of those days, and deleting the item does not refund them.

const KINDS = {
    routine: {
        model: Routine,
        idField: "routineId",
        isDueOn: isRoutineScheduledOn,
        // Each completion kept what it paid: the full amount, or half when it was late
        earned: async (routine) => {
            const logs = await RoutineLog.find({ routine: routine._id }).select("xpEarned");
            return logs.reduce((sum, log) => sum + (log.xpEarned || 0), 0);
        },
        doneOn: (routine, date) => RoutineLog.exists({ routine: routine._id, date }),
    },
    habit: {
        model: Habit,
        idField: "habitId",
        isDueOn: isHabitScheduledOn,
        // Logs from before the amount was kept on them paid what the habit is worth
        earned: async (habit) => {
            const logs = await HabitLog.find({ habit: habit._id, completed: true }).select("xpEarned");
            return logs.reduce((sum, log) => sum + (log.xpEarned ?? habit.xpReward ?? 0), 0);
        },
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
 *   xpTaken: the XP that left the account with it; owed: what tonight still charges for it, or 0
 */
export const moveItemToTrash = async (user, kind, id, now = new Date()) => {
    const { model, idField, isDueOn, earned, doneOn } = KINDS[kind];

    // Claimed in one step, so two requests arriving together can't both take its XP
    const item = await model.findOneAndUpdate(
        { _id: id, user: user._id, isActive: true },
        { $set: { isActive: false, ...trashStamp(user, now) } },
        { returnDocument: "after" },
    );
    if (!item) return null;

    let xpTaken = 0;
    const total = await earned(item);
    if (total > 0) {
        const { xpRevoked } = await revokeXP(user._id, total, "item_trashed", {
            [idField]: item._id,
            title: item.title,
        });
        xpTaken = xpRevoked;
    }
    // What was actually taken is what comes back: an account with less XP than the item earned loses less
    item.xpHeld = xpTaken;
    await model.updateOne({ _id: item._id }, { $set: { xpHeld: xpTaken } });

    // Today no longer asks for it, unless it was owed (see countsOn)
    const today = getUserToday(user, now);
    await updateDailyStreak(user._id, today);

    const stillOwed =
        countsOn(item, today, user.timezone) &&
        isDueOn(item, today) &&
        !(await doneOn(item, today));

    return { item, xpTaken, owed: stillOwed ? missCost(kind, item) : 0 };
};

/**
 * Brings a routine or a habit back from Trash exactly as it was, with the XP that left with it.
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
