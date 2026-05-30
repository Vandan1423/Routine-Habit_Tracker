import express from "express";
const router = express.Router();

import {
    getStats,
    getXPHistory,
} from "../controllers/gamificationController.js";
import { protect } from "../middlewares/authMiddleware.js";

// Apply the 'protect' middleware to all gamification routes
router.use(protect);

// --- GAMIFICATION ROUTES ---
// Base URL: /api/gamification

// @route   GET /api/gamification/stats
router.get("/stats", getStats);

// @route   GET /api/gamification/xp-history
router.get("/xp-history", getXPHistory);

export default router;
