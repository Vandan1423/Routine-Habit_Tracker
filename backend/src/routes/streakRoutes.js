import express from 'express';
const router = express.Router();

import {
    getStreakInfo,
    getDailyLogs
} from '../controllers/streakController.js';
import { protect } from '../middlewares/authMiddleware.js';

// Apply the authentication protection middleware to all routes in this file
router.use(protect);

// --- STREAK & PERFORMANCE ROUTES ---
// Base URL: /api/streaks

// @route   GET /api/streaks/info
router.get('/info', getStreakInfo);

// @route   GET /api/streaks/logs
router.get('/logs', getDailyLogs);

export default router;