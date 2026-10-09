import express from "express";
const router = express.Router();

import {
    getDay,
    getDays,
    getItems,
    getLedger,
} from "../controllers/historyController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import {
    dayParam,
    dayRangeQuerySchema,
    ledgerQuerySchema,
} from "../Schema/HistorySchema.js";

// Every route here is the signed-in user's own, and read-only
router.use(protect, settleDays);

// --- HISTORY ROUTES ---
// Base URL: /api/history

// @route   GET /api/history/days
router.get("/days", validate({ query: dayRangeQuerySchema }), getDays);

// @route   GET /api/history/days/:date
router.get("/days/:date", validate({ params: dayParam }), getDay);

// @route   GET /api/history/items
router.get("/items", validate({ query: dayRangeQuerySchema }), getItems);

// @route   GET /api/history/ledger
router.get("/ledger", validate({ query: ledgerQuerySchema }), getLedger);

export default router;
