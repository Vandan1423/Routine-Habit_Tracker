import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import User from "../models/User.js";
import { awardXP } from "../utils/rewardEngine.js";
import {
    calculateStreak,
    getLocalYYYYMMDD,
} from "../utils/streakCalculator.js";

// --- CONTROLLERS ---

// @desc    Create a new habit
// @route   POST /api/habits
export const createHabit = async (req, res) => {
    try {
        // xpReward is automatically calculated by the Habit model's pre('save') hook based on difficulty!
        const habit = await Habit.create({
            ...req.body,
            user: req.user._id,
        });

        res.status(201).json({ habit });
    } catch (error) {
        res.status(500).json({
            message: "Error creating habit",
            error: error.message,
        });
    }
};

// @desc    Get all active habits with today's log status
// @route   GET /api/habits
export const getHabits = async (req, res) => {
    try {
        // 1. Fetch all active habits for the user
        const habits = await Habit.find({ user: req.user._id, isActive: true });

        // 2. Fetch all logs for today
        const todayStr = getLocalYYYYMMDD();
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
        res.status(500).json({
            message: "Error fetching habits",
            error: error.message,
        });
    }
};

// @desc    Log a habit (Complete it or Add incremental progress)
// @route   POST /api/habits/:id/log
export const logHabit = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, quantity = 1, note } = req.body;
        const logDate = date || getLocalYYYYMMDD();

        const habit = await Habit.findOne({ _id: id, user: req.user._id });
        if (!habit) return res.status(404).json({ message: "Habit not found" });

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
            const currentStreak = await calculateStreak(id, req.user._id);

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

        // 4. Return everything the frontend needs, including the reward object
        res.status(200).json({
            habit,
            log,
            justCompleted: isFirstTimeCompletingToday,
            reward,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error logging habit",
            error: error.message,
        });
    }
};

// @desc    Update a habit's definition
// @route   PUT /api/habits/:id
export const updateHabit = async (req, res) => {
    try {
        const habit = await Habit.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            req.body,
            { returnDocument: "after", runValidators: true },
        );

        if (!habit) {
            return res
                .status(404)
                .json({ message: "Habit not found or unauthorized" });
        }

        // If the user changed the difficulty, we need to save the document so the pre('save') hook recalculates the XP
        await habit.save();

        res.status(200).json({ habit });
    } catch (error) {
        res.status(500).json({
            message: "Error updating habit",
            error: error.message,
        });
    }
};

// @desc    Soft delete a habit
// @route   DELETE /api/habits/:id
export const deleteHabit = async (req, res) => {
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
        res.status(500).json({
            message: "Error deleting habit",
            error: error.message,
        });
    }
};
