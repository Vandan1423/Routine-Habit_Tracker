import express from "express";
const router = express.Router();

import { getWeek, updateWeek } from "../controllers/weekController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { updateWeekSchema, weekParam } from "../Schema/WeekSchema.js";

// --- WEEK ROUTES ---
// Base URL: /api/weeks
// A week is named by its first day, as the person's own week starts

router.use(protect);

router
    .route("/:start")
    .get(validate({ params: weekParam }), getWeek)
    .put(validate({ params: weekParam, body: updateWeekSchema }), updateWeek);

export default router;
