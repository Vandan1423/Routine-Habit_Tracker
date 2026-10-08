import express from "express";
import {
    createRoutine,
    getRoutines,
    updateRoutine,
    deleteRoutine,
    reorderRoutines,
    completeRoutine,
    uncompleteRoutine,
} from "../controllers/routineController.js";
import { protect } from "../middlewares/authMiddleware.js"; // Ensure the path matches your structure
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import {
    completeRoutineSchema,
    createRoutineSchema,
    reorderRoutinesSchema,
    routinesQuerySchema,
    uncompleteRoutineSchema,
    updateRoutineSchema,
} from "../Schema/RoutineSchema.js";

const router = express.Router();

// ALL routine routes must be protected
router.use(protect, settleDays);
router
    .route("/reorder")
    .put(validate({ body: reorderRoutinesSchema }), reorderRoutines);

// Standard CRUD routes
router
    .route("/")
    .post(validate({ body: createRoutineSchema }), createRoutine)
    .get(validate({ query: routinesQuerySchema }), getRoutines);
router
    .route("/:id")
    .put(validate({ params: idParam, body: updateRoutineSchema }), updateRoutine)
    .delete(validate({ params: idParam }), deleteRoutine);
router.post(
    "/:id/complete",
    validate({ params: idParam, body: completeRoutineSchema }),
    completeRoutine,
);
router.delete(
    "/:id/complete",
    validate({ params: idParam, body: uncompleteRoutineSchema }),
    uncompleteRoutine,
);

export default router;
