import express from 'express';
const router = express.Router();

import {
    getStreakInfo,
    getDailyLogs,
    getRecap
} from '../controllers/streakController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { settleDays } from '../middlewares/dayRolloverMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { dailyLogsQuerySchema } from '../Schema/StreakSchema.js';

// Apply the authentication protection middleware to all routes in this file
router.use(protect, settleDays);

// --- STREAK & PERFORMANCE ROUTES ---
// Base URL: /api/streaks

// @route   GET /api/streaks/info
router.get('/info', getStreakInfo);

// @route   GET /api/streaks/logs
router.get('/logs', validate({ query: dailyLogsQuerySchema }), getDailyLogs);

// @route   GET /api/streaks/recap
router.get('/recap', getRecap);

export default router;