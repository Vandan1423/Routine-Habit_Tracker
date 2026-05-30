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

const router = express.Router();

// ALL routine routes must be protected
router.use(protect);
router.route("/reorder").put(reorderRoutines);

// Standard CRUD routes
router.route("/").post(createRoutine).get(getRoutines);
router.route("/:id").put(updateRoutine).delete(deleteRoutine);
router.post("/:id/complete", completeRoutine);
router.delete("/:id/complete", uncompleteRoutine);

export default router;
