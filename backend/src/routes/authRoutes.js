import express from "express";
const router = express.Router();
import {
    registerUser,
    loginUser,
    logoutUser,
    logoutAll,          
    refreshAccessToken,
    getMe,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

// --- PUBLIC ROUTES (No token required) ---
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// --- PROTECTED ROUTES (Requires valid access token) ---
router.route("/me").get(protect, getMe);
router.route("/logout").post(protect, logoutUser);
router.route("/logout-all").post(protect, logoutAll); 

export default router;