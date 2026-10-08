import express from "express";
const router = express.Router();

import {
    createHabit,
    getHabits,
    logHabit,
    updateHabit,
    deleteHabit,
} from "../controllers/habitController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import {
    createHabitSchema,
    logHabitSchema,
    updateHabitSchema,
} from "../Schema/HabitSchema.js";

// --- HABIT ROUTES ---
// Base URL: /api/habits

// Apply the 'protect' middleware to all habit routes automatically
// (so we don't have to type it 5 times!)
router.use(protect, settleDays);

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

// Route for logging a habit completion: /api/habits/:id/log
router
    .route("/:id/log")
    .post(validate({ params: idParam, body: logHabitSchema }), logHabit);

export default router;
