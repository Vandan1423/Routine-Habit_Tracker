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

// --- HABIT ROUTES ---
// Base URL: /api/habits

// Apply the 'protect' middleware to all habit routes automatically
// (so we don't have to type it 5 times!)
router.use(protect);

// Routes for /api/habits
router.route("/").get(getHabits).post(createHabit);

// Routes for /api/habits/:id
router.route("/:id").put(updateHabit).delete(deleteHabit);

// Route for logging a habit completion: /api/habits/:id/log
router.route("/:id/log").post(logHabit);

export default router;
