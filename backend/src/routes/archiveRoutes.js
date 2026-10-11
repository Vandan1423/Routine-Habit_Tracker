import express from "express";
const router = express.Router();

import { getArchive } from "../controllers/archiveController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";

// --- ARCHIVE ROUTES ---
// Base URL: /api/archive
// Things get here through their own archive routes (POST /api/routines/:id/archive), and leave through
// their unarchive routes, or their DELETE routes for Trash.

router.use(protect, settleDays);

router.get("/", getArchive);

export default router;
