import express from "express";
const router = express.Router();

import {
    emptyTrash,
    eraseTrashed,
    getTrash,
    restoreTrashed,
} from "../controllers/trashController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { settleDays } from "../middlewares/dayRolloverMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { trashedParam } from "../Schema/TrashSchema.js";

// --- TRASH ROUTES ---
// Base URL: /api/trash
// Things get here through their own DELETE routes. How long they stay is the account's trashDays (PUT /api/auth/me).

// Days that have ended are closed first: bringing a routine or habit back changes what today asks for
router.use(protect, settleDays);

router.route("/").get(getTrash).delete(emptyTrash);

router.post("/:kind/:id/restore", validate({ params: trashedParam }), restoreTrashed);
router.delete("/:kind/:id", validate({ params: trashedParam }), eraseTrashed);

export default router;
