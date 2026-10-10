import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import User from "../models/User.js";
import { awardXP, revokeXP } from "../utils/rewardEngine.js";
import {
    calculateBestStreak,
    calculateStreak,
} from "../utils/streakCalculator.js";
import { getUserToday, isHabitScheduledOn } from "../utils/dateRules.js";
import { addDailyXp } from "../utils/dailySummary.js";
import { updateDailyStreak } from "../utils/dailyStreakCalculator.js";
import { buildHistory, missedDaysOf } from "../utils/itemHistory.js";
import { moveItemToTrash, restoreItemFromTrash } from "../utils/itemTrash.js";
import { keyOf, saveOnce } from "../utils/saveOnce.js";

// --- HELPERS ---

const countCompletions = (habitId) =>
    HabitLog.countDocuments({ habit: habitId, completed: true });

/**
 * A habit has just reached its target for today: bring its streak and totals up to date and pay the XP.
 * @returns {Object} - the reward, as awardXP reports it
 */
const rewardCompletion = async (habit, userId, today) => {
    const currentStreak = await calculateStreak(habit._id, userId, today);

    habit.currentStreak = currentStreak;
    if (currentStreak > habit.bestStreak) habit.bestStreak = currentStreak;
    habit.totalCompletions = await countCompletions(habit._id);
    await habit.save();

    const reward = await awardXP(userId, habit.xpReward, "habit_complete", {
        habitId: habit._id,
        habitTitle: habit.title,
        streakCount: habit.currentStreak,
    });
    await addDailyXp(userId, today, habit.xpReward);

    return reward;
};

/**
 * The reverse: today's completion was taken back. The streak and totals go back to where they stood,
 * and the XP it paid is returned (with any level-up coins, see revokeXP).
 * @param {Number} xpEarned - what the completion paid
 */
const revokeCompletion = async (habit, userId, today, xpEarned) => {
    const streakWithToday = habit.currentStreak;

    habit.currentStreak = await calculateStreak(habit._id, userId, today);
    // Today's completion can only have raised the best streak if the two stood level
    if (habit.bestStreak === streakWithToday) {
        habit.bestStreak = await calculateBestStreak(habit._id, userId);
    }
    habit.totalCompletions = await countCompletions(habit._id);
    await habit.save();

    const reversal = await revokeXP(userId, xpEarned, "habit_uncomplete", {
        habitId: habit._id,
        habitTitle: habit.title,
        date: today,
    });
    await addDailyXp(userId, today, -reversal.xpRevoked);

    return reversal;
};

// The place after the last of a user's habits: where a new one, or one moved to another part of the day, lands
const nextOrder = async (userId) => {
    const last = await Habit.findOne({ user: userId, isActive: true })
        .sort({ order: -1 })
        .select("order");

    return last ? (last.order ?? 0) + 1 : 0;
};

const isDuplicateKey = (error) => error?.code === 11000;

/**
 * Writes today's count for a habit and reports whether that crossed its target, and in which direction.
 * Each crossing is claimed in a single database operation, so two requests arriving together
 * can't both be paid for the same completion, or both be refunded for the same undo.
 * @returns {Object} - log: today's log as it now stands (null when nothing is logged);
 *   crossed: "up", "down" or null; xpEarned: what the completion had paid, when it crossed down
 */
const writeTodaysLog = async (habit, userId, date, quantity, attempt = 1) => {
    const key = { habit: habit._id, user: userId, date };
    const notComplete = { ...key, completed: { $ne: true } };

    try {
        if (quantity <= 0) {
            const removed = await HabitLog.findOneAndDelete(key);

            return {
                log: null,
                crossed: removed?.completed ? "down" : null,
                xpEarned: removed?.xpEarned ?? habit.xpReward,
            };
        }

        if (quantity >= habit.targetQuantity) {
            // Matches a log that is not complete yet, or creates one. If today's log is already complete
            // it matches nothing, tries to create a second one, and the unique index refuses: see below.
            const log = await HabitLog.findOneAndUpdate(
                notComplete,
                { $set: { quantity, completed: true, xpEarned: habit.xpReward } },
                { upsert: true, returnDocument: "after" },
            );

            return { log, crossed: "up" };
        }

        // Below the target. First, a complete log dropping back under it
        const wasComplete = await HabitLog.findOneAndUpdate(
            { ...key, completed: true },
            { $set: { quantity, completed: false }, $unset: { xpEarned: "" } },
            { returnDocument: "before" },
        );
        if (wasComplete) {
            const xpEarned = wasComplete.xpEarned ?? habit.xpReward;
            const log = await HabitLog.findOne(key);

            return { log, crossed: "down", xpEarned };
        }

        const log = await HabitLog.findOneAndUpdate(
            notComplete,
            { $set: { quantity, completed: false } },
            { upsert: true, returnDocument: "after" },
        );

        return { log, crossed: null };
    } catch (error) {
        if (!isDuplicateKey(error)) throw error;

        // Today's log is already complete, and the count is at or above the target: only the number changes
        if (quantity >= habit.targetQuantity) {
            const log = await HabitLog.findOneAndUpdate(
                { ...key, completed: true },
                { $set: { quantity } },
                { returnDocument: "after" },
            );
            if (log) return { log, crossed: null };
        }

        // Otherwise another request changed the log in between. Look again, once.
        if (attempt >= 2) throw error;
        return writeTodaysLog(habit, userId, date, quantity, attempt + 1);
    }
};

// --- CONTROLLERS ---

// @desc    Create a new habit
// @route   POST /api/habits
export const createHabit = async (req, res, next) => {
    try {
        // xpReward is automatically calculated by the Habit model's pre('save') hook based on difficulty!
        const { doc: habit } = await saveOnce(
            new Habit({
                ...req.body,
                order: req.body.order ?? (await nextOrder(req.user._id)),
                user: req.user._id,
            }),
            keyOf(req),
        );

        res.status(201).json({ habit });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all active habits with today's log status
// @route   GET /api/habits
export const getHabits = async (req, res, next) => {
    try {
        // 1. Fetch all active habits for the user
        //    in the order the user has put them in (habits never reordered keep the order they were made in)
        const habits = await Habit.find({
            user: req.user._id,
            isActive: true,
        }).sort({ order: 1, createdAt: 1 });

        // 2. Fetch all logs for today
        const todayStr = getUserToday(req.user);
        const todayLogs = await HabitLog.find({
            user: req.user._id,
            date: todayStr,
        });

        // 3. Attach today's log to each habit so the frontend knows if it's "checked"
        const habitsWithLogs = habits.map((habit) => {
            const habitObj = habit.toObject(); // Convert from Mongoose document to plain JS object

            // Find the specific log for this habit, if it exists
            const log = todayLogs.find(
                (l) => l.habit.toString() === habit._id.toString(),
            );

            habitObj.todayLog = log || null;
            // A habit kept for some weekdays only is listed every day; this says whether today is one of its days
            habitObj.dueToday = isHabitScheduledOn(habit, todayStr);
            return habitObj;
        });

        // "today" is the user's own calendar day, as the server counts it
        res.status(200).json({ habits: habitsWithLogs, today: todayStr });
    } catch (error) {
        next(error);
    }
};

// @desc    Log a habit (Complete it or Add incremental progress)
// @route   POST /api/habits/:id/log
export const logHabit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date, quantity = 1, note } = req.body;
        const today = getUserToday(req.user);
        const logDate = date || today;

        const habit = await Habit.findOne({
            _id: id,
            user: req.user._id,
            isActive: true,
        });
        if (!habit) return res.status(404).json({ message: "Habit not found" });

        // A day is closed once it ends in the user's timezone
        if (logDate !== today) {
            return res.status(400).json({
                message: "Habits can only be logged for the current day.",
            });
        }

        // 1. Find existing log or create a new one
        let log = await HabitLog.findOne({
            habit: id,
            user: req.user._id,
            date: logDate,
        });
        let isFirstTimeCompletingToday = false;

        if (!log) {
            const newQuantity =
                habit.habitType === "quantity"
                    ? Number(quantity)
                    : habit.targetQuantity;
            const isCompleted =
                habit.habitType === "quantity"
                    ? newQuantity >= habit.targetQuantity
                    : true;

            log = new HabitLog({
                habit: id,
                user: req.user._id,
                date: logDate,
                quantity: newQuantity,
                completed: isCompleted,
                note: note || "",
                xpEarned: isCompleted ? habit.xpReward : undefined,
            });
            await log.save();

            if (isCompleted) isFirstTimeCompletingToday = true;
        } else {
            const wasAlreadyCompleted = log.completed;

            if (habit.habitType === "quantity") {
                log.quantity += Number(quantity);
                if (log.quantity >= habit.targetQuantity) {
                    log.completed = true;
                }
            } else {
                log.completed = true;
                log.quantity = habit.targetQuantity;
            }

            if (!wasAlreadyCompleted && log.completed) {
                isFirstTimeCompletingToday = true;
                log.xpEarned = habit.xpReward;
            }

            if (note) log.note = note;
            await log.save();
        }

        // 2. Only calculate streaks and award XP if they JUST crossed the finish line
        let reward = null;

        if (isFirstTimeCompletingToday) {
            reward = await rewardCompletion(habit, req.user._id, today);
        }

        // Keep the day's summary in step: a habit counts towards a day with everything done
        await updateDailyStreak(req.user._id, logDate);

        // 4. Return everything the frontend needs, including the reward object
        res.status(200).json({
            habit,
            log,
            justCompleted: isFirstTimeCompletingToday,
            reward,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Set how far a habit has got today (tick it, un-tick it, or step a counted habit up or down)
// @route   PUT /api/habits/:id/log
export const setHabitLog = async (req, res, next) => {
    try {
        const today = getUserToday(req.user);

        const habit = await Habit.findOne({
            _id: req.params.id,
            user: req.user._id,
            isActive: true,
        });
        if (!habit) return res.status(404).json({ message: "Habit not found" });

        // A yes-or-no habit is either done or not; a counted one keeps the number it was given
        const quantity =
            habit.habitType === "quantity"
                ? req.body.quantity
                : req.body.quantity > 0
                  ? habit.targetQuantity
                  : 0;

        const { log, crossed, xpEarned } = await writeTodaysLog(
            habit,
            req.user._id,
            today,
            quantity,
        );

        // Reaching the target pays the habit's XP; dropping back under it returns what was paid
        let reward = null;
        if (crossed === "up") {
            reward = await rewardCompletion(habit, req.user._id, today);
        } else if (crossed === "down") {
            reward = await revokeCompletion(habit, req.user._id, today, xpEarned);
        }

        // A habit counts towards a day with everything done, so the day's standing may have changed either way
        await updateDailyStreak(req.user._id, today);

        res.status(200).json({
            habit,
            log,
            justCompleted: crossed === "up",
            justUncompleted: crossed === "down",
            reward,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a habit's definition
// @route   PUT /api/habits/:id
export const updateHabit = async (req, res, next) => {
    try {
        const habit = await Habit.findOne({
            _id: req.params.id,
            user: req.user._id,
            isActive: true,
        });

        if (!habit) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        // Apply the changes to the loaded document and save it, so the pre('save') hook
        // sees a changed difficulty and recalculates the XP
        // Moved to another part of the day without being given a place there: it goes last
        const moved =
            req.body.timeOfDay !== undefined &&
            req.body.timeOfDay !== (habit.timeOfDay ?? "anytime") &&
            req.body.order === undefined;

        habit.set(req.body);
        if (moved) habit.order = await nextOrder(req.user._id);
        await habit.save();

        res.status(200).json({ habit });
    } catch (error) {
        next(error);
    }
};

// @desc    Move a habit to Trash. Its XP stays with the account.
// @route   DELETE /api/habits/:id
export const deleteHabit = async (req, res, next) => {
    try {
        const moved = await moveItemToTrash(req.user, "habit", req.params.id);

        if (!moved) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        res.status(200).json({
            message: "Habit moved to Trash",
            id: req.params.id,
            purgeAt: moved.item.purgeAt,
            xpTaken: moved.xpTaken,
            // What tonight still charges for it: it was due today and was not done
            owed: moved.owed,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Bring back a habit that is in Trash
// @route   POST /api/habits/:id/restore
export const restoreHabit = async (req, res, next) => {
    try {
        const restored = await restoreItemFromTrash(req.user, "habit", req.params.id);

        if (!restored) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        res.status(200).json({ habit: restored.item });
    } catch (error) {
        next(error);
    }
};

// @desc    Put habits in a new order
// @route   PUT /api/habits/reorder
export const reorderHabits = async (req, res, next) => {
    try {
        await Promise.all(
            req.body.habits.map((item) =>
                // Matching on the owner as well: an id that belongs to someone else changes nothing
                Habit.updateOne(
                    { _id: item.id, user: req.user._id },
                    { order: item.order },
                ),
            ),
        );

        res.status(200).json({ message: "Habits reordered successfully" });
    } catch (error) {
        next(error);
    }
};

// @desc    The days a habit was done, partly done or missed, with its totals and runs
// @route   GET /api/habits/:id/history
export const getHabitHistory = async (req, res, next) => {
    try {
        const habit = await Habit.findOne({
            _id: req.params.id,
            user: req.user._id,
            isActive: true,
        });
        if (!habit) return res.status(404).json({ message: "Habit not found" });

        const [logs, missed] = await Promise.all([
            HabitLog.find({ habit: habit._id, user: req.user._id }).select(
                "date completed quantity",
            ),
            missedDaysOf(req.user._id, "habit_missed", "habitId", habit._id),
        ]);

        const history = buildHistory({
            user: req.user,
            item: habit,
            today: getUserToday(req.user),
            recorded: logs
                // A log that holds nothing (a count stepped back to zero the old way) is not a day worth showing
                .filter((log) => log.completed || log.quantity > 0)
                .map((log) => ({
                    date: log.date,
                    status: log.completed ? "done" : "partial",
                    quantity: log.quantity,
                })),
            missed,
            isDueOn: (date) => isHabitScheduledOn(habit, date),
        });

        res.status(200).json(history);
    } catch (error) {
        next(error);
    }
};
