import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import { awardXP } from "../utils/rewardEngine.js";
import { getLocalYYYYMMDD } from "../utils/streakCalculator.js";
import { updateDailyStreak } from "../utils/dailyStreakCalculator.js";

// @desc    Create a new routine
// @route   POST /api/routines
export const createRoutine = async (req, res) => {
    try {
        // 1. ADD 'date' TO DESTRUCTURED BODY
        const {
            title,
            description,
            startTime,
            endTime,
            category,
            isRecurring,
            recurringDays,
            order,
            xpReward,
            date,
        } = req.body;

        if (!title || !startTime) {
            return res
                .status(400)
                .json({ message: "Title and Start Time are required" });
        }

        const routine = await Routine.create({
            user: req.user._id,
            title,
            description,
            startTime,
            endTime,
            category,
            isRecurring,
            recurringDays,
            order,
            xpReward,
            date, // 2. SAVE THE DATE
        });

        res.status(201).json(routine);
    } catch (error) {
        res.status(500).json({
            message: "Error creating routine",
            error: error.message,
        });
    }
};

// @desc    Get routines (filtered by date)
// @route   GET /api/routines
export const getRoutines = async (req, res) => {
    try {
        const query = {
            user: req.user._id,
            isActive: true,
        };

        // Date handling
        const dateQuery =
            req.query.date || new Date().toISOString().split("T")[0];

        if (dateQuery) {
            const requestedDate = new Date(dateQuery);
            const dayOfWeek = requestedDate.getDay();

            query.$or = [
                { isRecurring: true, recurringDays: { $in: [dayOfWeek] } },
                { isRecurring: false, date: dateQuery },
            ];
        }

        const routines = await Routine.find(query).sort({
            order: 1,
            startTime: 1,
        });

        // --- NEW: FETCH TODAY'S LOGS & ATTACH STATUS ---
        // We use the same dateQuery to ensure logs match the routines requested
        const logs = await RoutineLog.find({
            user: req.user._id,
            date: dateQuery,
        });

        const logMap = {};
        logs.forEach((log) => {
            logMap[log.routine.toString()] = log;
        });

        const routinesWithStatus = routines.map((r) => ({
            ...r.toObject(),
            todayLog: logMap[r._id.toString()] || null,
        }));

        res.status(200).json({ routines: routinesWithStatus });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// @desc    Update a routine
// @route   PUT /api/routines/:id
export const updateRoutine = async (req, res) => {
    try {
        // Find routine by ID AND User ID (prevents modifying someone else's routine)
        let routine = await Routine.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!routine) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }

        // Update the document
        routine = await Routine.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: "after",
            runValidators: true,
        });

        res.status(200).json(routine);
    } catch (error) {
        res.status(500).json({
            message: "Error updating routine",
            error: error.message,
        });
    }
};

// @desc    Soft delete a routine
// @route   DELETE /api/routines/:id
export const deleteRoutine = async (req, res) => {
    try {
        const routine = await Routine.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!routine) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }

        // Soft delete: Set isActive to false instead of deleting the document
        routine.isActive = false;
        await routine.save();

        res.status(200).json({
            message: "Routine successfully removed",
            id: req.params.id,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error deleting routine",
            error: error.message,
        });
    }
};

// @desc    Reorder multiple routines
// @route   PUT /api/routines/reorder
export const reorderRoutines = async (req, res) => {
    try {
        // Destructure 'routines' from the request body to match your frontend payload
        const { routines } = req.body;

        if (!Array.isArray(routines)) {
            return res.status(400).json({
                message: "Invalid payload format. Expected { routines: [...] }",
            });
        }

        // Use Promise.all to update all routines simultaneously
        await Promise.all(
            routines.map(async (item) => {
                // Verify ownership during update
                await Routine.findOneAndUpdate(
                    { _id: item.id, user: req.user._id },
                    { order: item.order },
                    { returnDocument: "after" }, // Modern mongoose syntax
                );
            }),
        );

        res.status(200).json({ message: "Routines reordered successfully" });
    } catch (error) {
        res.status(500).json({
            message: "Error reordering routines",
            error: error.message,
        });
    }
};

// @desc    Complete a routine
// @route   POST /api/routines/:id/complete
export const completeRoutine = async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.body;
        const logDate = date || getLocalYYYYMMDD();

        // 1. Check if already completed
        const existingLog = await RoutineLog.findOne({
            routine: id,
            date: logDate,
        });
        if (existingLog) {
            return res.status(400).json({ message: "Already completed today" });
        }

        const routine = await Routine.findOne({ _id: id, user: req.user._id });
        if (!routine)
            return res.status(404).json({ message: "Routine not found" });

        // 2. Calculate completion time and punctuality
        const now = new Date();
        const completedAt = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        // Parse time strings (e.g., "14:30") into minutes from midnight for comparison
        const timeToMinutes = (timeStr) => {
            const [h, m] = timeStr.split(":").map(Number);
            return h * 60 + m;
        };

        const currentMinutes = timeToMinutes(completedAt);
        const endMinutes = timeToMinutes(routine.endTime);

        // "Late" if more than 15 minutes after endTime
        const wasOnTime = currentMinutes <= endMinutes + 15;
        const xpEarned = wasOnTime
            ? routine.xpReward
            : Math.floor(routine.xpReward / 2);

        // 3. Save Log
        const log = await RoutineLog.create({
            routine: id,
            user: req.user._id,
            date: logDate,
            completedAt,
            wasOnTime,
            xpEarned,
        });

        // 4. Award XP via Engine
        const reward = await awardXP(
            req.user._id,
            xpEarned,
            "routine_complete",
            {
                routineId: id,
                wasOnTime,
            },
        );
        const dailyStats = await updateDailyStreak(req.user._id, logDate);

        res.status(200).json({ log, reward });
    } catch (error) {
        res.status(500).json({
            message: "Error completing routine",
            error: error.message,
        });
    }
};

// @desc    Uncomplete a routine (remove log)
// @route   DELETE /api/routines/:id/complete
export const uncompleteRoutine = async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.body;
        const logDate = date || getLocalYYYYMMDD();

        // Verify the routine belongs to this user
        const routine = await Routine.findOne({ _id: id, user: req.user._id });
        if (!routine) {
            return res.status(404).json({ message: "Routine not found" });
        }

        // Delete the log for this date
        const deleted = await RoutineLog.findOneAndDelete({
            routine: id,
            user: req.user._id,
            date: logDate,
        });

        if (!deleted) {
            return res
                .status(404)
                .json({ message: "No completion log found for this date" });
        }

        res.status(200).json({ message: "Routine unmarked successfully" });
    } catch (error) {
        res.status(500).json({
            message: "Error uncompleting routine",
            error: error.message,
        });
    }
};
