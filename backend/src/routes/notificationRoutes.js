import express from "express";
const router = express.Router();

import {
    getConfig,
    sendTest,
    subscribe,
    unsubscribe,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { subscribeSchema, unsubscribeSchema } from "../Schema/NotificationSchema.js";

// --- NOTIFICATION ROUTES ---
// Base URL: /api/notifications

router.use(protect);

router.get("/config", getConfig);
router
    .route("/subscriptions")
    .post(validate({ body: subscribeSchema }), subscribe)
    .delete(validate({ body: unsubscribeSchema }), unsubscribe);
router.post("/test", sendTest);

export default router;
