import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import User from "../models/User.js";
import { awardXP } from "../utils/rewardEngine.js";
import { calculateStreak } from "../utils/streakCalculator.js";
import { getUserToday } from "../utils/dateRules.js";
import { addDailyXp, syncHabitTotals } from "../utils/dailySummary.js";

// --- CONTROLLERS ---

// @desc    Create a new habit
// @route   POST /api/habits
export const createHabit = async (req, res, next) => {
    try {
        // xpReward is automatically calculated by the Habit model's pre('save') hook based on difficulty!
        const habit = await Habit.create({
            ...req.body,
            user: req.user._id,
        });

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
        const habits = await Habit.find({ user: req.user._id, isActive: true });

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
            return habitObj;
        });

        res.status(200).json({ habits: habitsWithLogs });
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

            if (note) log.note = note;
            await log.save();

            if (!wasAlreadyCompleted && log.completed) {
                isFirstTimeCompletingToday = true;
            }
        }

        // 2. Only calculate streaks and award XP if they JUST crossed the finish line
        let reward = null;

        if (isFirstTimeCompletingToday) {
            const allLogs = await HabitLog.find({
                habit: id,
                completed: true,
            }).sort({ date: -1 });
            const currentStreak = await calculateStreak(
                id,
                req.user._id,
                today,
            );

            habit.currentStreak = currentStreak;
            if (currentStreak > habit.bestStreak)
                habit.bestStreak = currentStreak;
            habit.totalCompletions = allLogs.length;
            await habit.save();

            // === 3. FIRE THE GAMIFICATION ENGINE ===
            reward = await awardXP(
                req.user._id,
                habit.xpReward,
                "habit_complete",
                {
                    habitId: habit._id,
                    habitTitle: habit.title,
                    streakCount: habit.currentStreak,
                },
            );
        }

        // Keep the day's summary (habits due and done, XP earned) in step
        if (isFirstTimeCompletingToday) {
            await addDailyXp(req.user._id, logDate, habit.xpReward);
        }
        await syncHabitTotals(req.user, logDate);

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

// @desc    Update a habit's definition
// @route   PUT /api/habits/:id
export const updateHabit = async (req, res, next) => {
    try {
        const habit = await Habit.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!habit) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        // Apply the changes to the loaded document and save it, so the pre('save') hook
        // sees a changed difficulty and recalculates the XP
        habit.set(req.body);
        await habit.save();

        res.status(200).json({ habit });
    } catch (error) {
        next(error);
    }
};

// @desc    Soft delete a habit
// @route   DELETE /api/habits/:id
export const deleteHabit = async (req, res, next) => {
    try {
        const habit = await Habit.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isActive: false },
            { returnDocument: "after" },
        );

        if (!habit) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        res.status(200).json({
            message: "Habit successfully deleted",
            id: req.params.id,
        });
    } catch (error) {
        next(error);
    }
};
