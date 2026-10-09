import express from "express";
const router = express.Router();

import {
    createHabit,
    getHabits,
    logHabit,
    setHabitLog,
    updateHabit,
    deleteHabit,
    restoreHabit,
    reorderHabits,
    getHabitHistory,
} from "../controllers/habitController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import {
    createHabitSchema,
    logHabitSchema,
    reorderHabitsSchema,
    setHabitLogSchema,
    updateHabitSchema,
} from "../Schema/HabitSchema.js";

// --- HABIT ROUTES ---
// Base URL: /api/habits

// Apply the 'protect' middleware to all habit routes automatically
// (so we don't have to type it 5 times!)
router.use(protect, settleDays);

// Before "/:id", which would otherwise take "reorder" for an id
router
    .route("/reorder")
    .put(validate({ body: reorderHabitsSchema }), reorderHabits);

// Routes for /api/habits
router
    .route("/")
    .get(getHabits)
    .post(validate({ body: createHabitSchema }), createHabit);

// Routes for /api/habits/:id
router
    .route("/:id")
    .put(validate({ params: idParam, body: updateHabitSchema }), updateHabit)
    .delete(validate({ params: idParam }), deleteHabit);

// Brings back a habit that was deleted
router.post("/:id/restore", validate({ params: idParam }), restoreHabit);

// The days a habit was done, partly done or missed
router.get("/:id/history", validate({ params: idParam }), getHabitHistory);

// Routes for today's log of a habit: /api/habits/:id/log
// POST adds to today's count, PUT sets it (and so can lower it or clear it)
router
    .route("/:id/log")
    .post(validate({ params: idParam, body: logHabitSchema }), logHabit)
    .put(validate({ params: idParam, body: setHabitLogSchema }), setHabitLog);

export default router;
