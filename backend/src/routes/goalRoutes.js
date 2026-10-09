import express from "express";
const router = express.Router();

import {
    createGoal,
    deleteGoal,
    getGoals,
    setMilestone,
    updateGoal,
} from "../controllers/goalController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import {
    createGoalSchema,
    milestoneParams,
    setMilestoneSchema,
    updateGoalSchema,
} from "../Schema/GoalSchema.js";

// --- GOAL ROUTES ---
// Base URL: /api/goals
// Bringing a deleted goal back is Trash's job: POST /api/trash/goal/:id/restore

router.use(protect);

router
    .route("/")
    .get(getGoals)
    .post(validate({ body: createGoalSchema }), createGoal);

router
    .route("/:id")
    .put(validate({ params: idParam, body: updateGoalSchema }), updateGoal)
    .delete(validate({ params: idParam }), deleteGoal);

router.put(
    "/:id/milestones/:milestoneId",
    validate({ params: milestoneParams, body: setMilestoneSchema }),
    setMilestone,
);

export default router;
