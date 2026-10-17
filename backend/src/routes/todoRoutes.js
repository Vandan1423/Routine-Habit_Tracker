import express from "express";
const router = express.Router();

import {
    clearDone,
    createList,
    createTodo,
    deleteList,
    deleteTodo,
    getPlanned,
    getTodos,
    updateList,
    updateTodo,
} from "../controllers/todoController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import { dayRangeQuerySchema } from "../Schema/HistorySchema.js";
import {
    createListSchema,
    createTodoSchema,
    updateListSchema,
    updateTodoSchema,
} from "../Schema/TodoSchema.js";

// --- TO-DO ROUTES ---
// Base URL: /api/todos
// Bringing a deleted list or to-do back is Trash's job: POST /api/trash/:kind/:id/restore

router.use(protect);

router
    .route("/")
    .get(getTodos)
    .post(validate({ body: createTodoSchema }), createTodo);

// What was planned for a stretch of days, for a week further back than the lists carry
router.get("/planned", validate({ query: dayRangeQuerySchema }), getPlanned);

// Before "/:id", which would otherwise take "lists" for an id
router.post("/lists", validate({ body: createListSchema }), createList);
router
    .route("/lists/:id")
    .put(validate({ params: idParam, body: updateListSchema }), updateList)
    .delete(validate({ params: idParam }), deleteList);
router.post("/lists/:id/clear", validate({ params: idParam }), clearDone);

router
    .route("/:id")
    .put(validate({ params: idParam, body: updateTodoSchema }), updateTodo)
    .delete(validate({ params: idParam }), deleteTodo);

export default router;
