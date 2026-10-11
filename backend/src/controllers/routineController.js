import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import { awardXP, revokeXP } from "../utils/rewardEngine.js";
import { updateDailyStreak } from "../utils/dailyStreakCalculator.js";
import { addDailyXp } from "../utils/dailySummary.js";
import {
    addDays,
    getUserClockTime,
    getUserToday,
    getWeekday,
    isPausedOn,
    isRoutineScheduledOn,
    timeToMinutes,
} from "../utils/dateRules.js";
import {
    archivedDayOf,
    archiveItem,
    ITEM_IN_PLAN_OR_ARCHIVE,
    unarchiveItem,
} from "../utils/itemArchive.js";
import { buildHistory, missedDaysOf } from "../utils/itemHistory.js";
import { pauseItem, resumeItem } from "../utils/itemPause.js";
import { moveItemToTrash, restoreItemFromTrash } from "../utils/itemTrash.js";
import { keyOf, saveOnce } from "../utils/saveOnce.js";

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

        const { doc: routine } = await saveOnce(
            new Routine({
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
            }),
            keyOf(req),
        );

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

        // A routine paused that day is not due on it, and is left off the day's list
        const routinesWithStatus = routines
            .filter((r) => !isPausedOn(r, dateQuery))
            .map((r) => ({
                ...r.toObject(),
                todayLog: logMap[r._id.toString()] || null,
            }));

        res.status(200).json({ routines: routinesWithStatus });
    } catch (error) {
        next(error);
    }
};

// @desc    Every routine in the plan: the repeating ones, the one-off tasks still to come,
//          and the one-off tasks of the last few days, so the week today is in can be shown whole
// @route   GET /api/routines/all
export const getAllRoutines = async (req, res, next) => {
    try {
        const today = getUserToday(req.user);

        const routines = await Routine.find({
            user: req.user._id,
            isActive: true,
            // A week starts on a different day in different places: six days back covers any of them.
            // A one-off task older than that is over, and no longer part of the plan.
            $or: [
                { isRecurring: true },
                { isRecurring: false, date: { $gte: addDays(today, -6) } },
            ],
        }).sort({ startTime: 1, order: 1 });

        res.status(200).json({ routines, today });
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
            isActive: true,
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

// @desc    Move a routine to Trash, from the plan or from Archive. Its XP stays with the account.
// @route   DELETE /api/routines/:id
export const deleteRoutine = async (req, res, next) => {
    try {
        const moved = await moveItemToTrash(req.user, "routine", req.params.id);

        if (!moved) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }

        res.status(200).json({
            message: "Routine moved to Trash",
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

// @desc    Bring back a routine that is in Trash
// @route   POST /api/routines/:id/restore
export const restoreRoutine = async (req, res, next) => {
    try {
        const restored = await restoreItemFromTrash(req.user, "routine", req.params.id);

        if (!restored) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }

        res.status(200).json(restored.item);
    } catch (error) {
        next(error);
    }
};

// @desc    Retire a routine: out of the plan and into Archive, history and XP kept, to be brought back any time
// @route   POST /api/routines/:id/archive
export const archiveRoutine = async (req, res, next) => {
    try {
        const retired = await archiveItem(req.user, "routine", req.params.id);

        if (!retired) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }
        if (retired.refused) {
            return res.status(400).json({ message: retired.refused });
        }

        res.status(200).json({
            message: "Routine retired",
            id: req.params.id,
            archivedAt: retired.item.archivedAt,
            // What tonight still charges for it: it was due today and was not done
            owed: retired.owed,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Bring a retired routine back from Archive into the plan
// @route   POST /api/routines/:id/unarchive
export const unarchiveRoutine = async (req, res, next) => {
    try {
        const back = await unarchiveItem(req.user, "routine", req.params.id);

        if (!back) {
            return res
                .status(404)
                .json({ message: "Routine not found in Archive" });
        }

        res.status(200).json(back.item);
    } catch (error) {
        next(error);
    }
};

// @desc    Pause a routine for a number of days: not due, not charged, no run broken
// @route   POST /api/routines/:id/pause
export const pauseRoutine = async (req, res, next) => {
    try {
        const paused = await pauseItem(req.user, "routine", req.params.id, req.body);

        if (!paused) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }
        if (paused.refused) {
            return res.status(400).json({ message: paused.refused });
        }

        res.status(200).json(paused.item);
    } catch (error) {
        next(error);
    }
};

// @desc    End a routine's pause early: it is due again from today
// @route   DELETE /api/routines/:id/pause
export const resumeRoutine = async (req, res, next) => {
    try {
        const resumed = await resumeItem(req.user, "routine", req.params.id);

        if (!resumed) {
            return res
                .status(404)
                .json({ message: "Routine not found or unauthorized" });
        }

        res.status(200).json(resumed.item);
    } catch (error) {
        next(error);
    }
};

// @desc    The days a routine was done, done late or missed, with its totals and runs.
//          A retired routine's history can still be looked at, from Archive.
// @route   GET /api/routines/:id/history
export const getRoutineHistory = async (req, res, next) => {
    try {
        const routine = await Routine.findOne({
            _id: req.params.id,
            user: req.user._id,
            ...ITEM_IN_PLAN_OR_ARCHIVE,
        });
        if (!routine)
            return res.status(404).json({ message: "Routine not found" });
        // Nothing was asked of it after the day it was retired
        const retiredOn = archivedDayOf(routine, req.user.timezone);

        const [logs, missed] = await Promise.all([
            RoutineLog.find({ routine: routine._id, user: req.user._id }).select(
                "date wasOnTime xpEarned completedAt",
            ),
            missedDaysOf(req.user._id, "routine_missed", "routineId", routine._id),
        ]);

        const history = buildHistory({
            user: req.user,
            item: routine,
            today: getUserToday(req.user),
            recorded: logs.map((log) => ({
                date: log.date,
                status: log.wasOnTime === false ? "late" : "done",
                completedAt: log.completedAt,
                xpEarned: log.xpEarned,
            })),
            missed,
            isDueOn: (date) =>
                isRoutineScheduledOn(routine, date) && !(retiredOn && date > retiredOn),
        });

        res.status(200).json(history);
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
        if (isPausedOn(routine, logDate)) {
            return res.status(400).json({
                message: "This routine is paused today.",
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
        await updateDailyStreak(req.user._id, logDate);

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

        // Verify the routine belongs to this user. One in Trash stays as it is.
        const routine = await Routine.findOne({ _id: id, user: req.user._id, isActive: true });
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
