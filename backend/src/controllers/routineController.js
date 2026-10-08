import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import { awardXP, revokeXP } from "../utils/rewardEngine.js";
import { updateDailyStreak } from "../utils/dailyStreakCalculator.js";
import { addDailyXp } from "../utils/dailySummary.js";
import {
    getUserClockTime,
    getUserToday,
    getWeekday,
    isRoutineScheduledOn,
} from "../utils/dateRules.js";

// @desc    Create a new routine
// @route   POST /api/routines
export const createRoutine = async (req, res, next) => {
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
            date, // 2. SAVE THE DATE
        });

        res.status(201).json(routine);
    } catch (error) {
        next(error);
    }
};

// @desc    Get routines (filtered by date)
// @route   GET /api/routines
export const getRoutines = async (req, res, next) => {
    try {
        const query = {
            user: req.user._id,
            isActive: true,
        };

        // Date handling
        const dateQuery = req.query.date || getUserToday(req.user);

        if (dateQuery) {
            const dayOfWeek = getWeekday(dateQuery);

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
        next(error);
    }
};

// @desc    Update a routine
// @route   PUT /api/routines/:id
export const updateRoutine = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Soft delete a routine
// @route   DELETE /api/routines/:id
export const deleteRoutine = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Reorder multiple routines
// @route   PUT /api/routines/reorder
export const reorderRoutines = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Complete a routine
// @route   POST /api/routines/:id/complete
export const completeRoutine = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date } = req.body;
        const today = getUserToday(req.user);
        const logDate = date || today;

        const routine = await Routine.findOne({
            _id: id,
            user: req.user._id,
            isActive: true,
        });
        if (!routine)
            return res.status(404).json({ message: "Routine not found" });

        // A routine only earns XP on a day it is scheduled for, and a day is closed
        // once it ends in the user's timezone
        if (logDate !== today) {
            return res.status(400).json({
                message: "Routines can only be completed for the current day.",
            });
        }
        if (!isRoutineScheduledOn(routine, logDate)) {
            return res.status(400).json({
                message: "This routine is not scheduled for that day.",
            });
        }

        // 1. Check if already completed
        const existingLog = await RoutineLog.findOne({
            routine: id,
            date: logDate,
        });
        if (existingLog) {
            return res.status(400).json({ message: "Already completed today" });
        }

        // 2. Calculate completion time and punctuality
        // The server's clock, in the user's timezone, decides when it was done
        const completedAt = getUserClockTime(req.user);

        // Parse either "14:30" or "2:30 PM" into minutes from midnight for comparison
        const timeToMinutes = (timeStr) => {
            if (!timeStr) return null;

            const trimmed = String(timeStr).trim();
            const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
            if (ampmMatch) {
                let hour = Number(ampmMatch[1]);
                const minutes = Number(ampmMatch[2]);
                const meridiem = ampmMatch[3].toUpperCase();

                if (meridiem === "PM" && hour !== 12) hour += 12;
                if (meridiem === "AM" && hour === 12) hour = 0;

                return hour * 60 + minutes;
            }

            const [h, m] = trimmed.split(":").map(Number);
            return h * 60 + m;
        };

        const currentMinutes = timeToMinutes(completedAt);
        const endMinutes = timeToMinutes(routine.endTime);

        // "Late" if more than 15 minutes after endTime. With no end time there is no deadline to miss.
        const wasOnTime = endMinutes === null || currentMinutes <= endMinutes + 15;
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
        await addDailyXp(req.user._id, logDate, xpEarned);
        const dailyStats = await updateDailyStreak(req.user._id, logDate);

        res.status(200).json({ log, reward });
    } catch (error) {
        next(error);
    }
};

// @desc    Uncomplete a routine (remove log)
// @route   DELETE /api/routines/:id/complete
export const uncompleteRoutine = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date } = req.body;
        const today = getUserToday(req.user);
        const logDate = date || today;

        // Verify the routine belongs to this user
        const routine = await Routine.findOne({ _id: id, user: req.user._id });
        if (!routine) {
            return res.status(404).json({ message: "Routine not found" });
        }

        if (logDate !== today) {
            return res.status(400).json({
                message: "Routines can only be changed for the current day.",
            });
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

        // Undoing a completion takes back the XP it earned, then re-evaluates the day
        // (a perfect day that is no longer perfect loses its bonus too)
        if (deleted.xpEarned > 0) {
            const { xpRevoked } = await revokeXP(
                req.user._id,
                deleted.xpEarned,
                "routine_uncomplete",
                { routineId: id, date: logDate },
            );
            await addDailyXp(req.user._id, logDate, -xpRevoked);
        }
        await updateDailyStreak(req.user._id, logDate);

        res.status(200).json({ message: "Routine unmarked successfully" });
    } catch (error) {
        next(error);
    }
};
