import express from "express";
const router = express.Router();

import { runDaily, runReminders, scheduledOnly } from "../controllers/jobController.js";

// --- JOB ROUTES ---
// Base URL: /api/jobs
// Called by schedulers, never by the app (see jobController.js)

router.use(scheduledOnly);

router.get("/daily", runDaily);
router.get("/reminders", runReminders);

export default router;
