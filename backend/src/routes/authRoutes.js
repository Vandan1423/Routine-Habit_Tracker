import express from "express";
const router = express.Router();
import {
    registerUser,
    loginUser,
    logoutUser,
    logoutAll,          
    refreshAccessToken,
    getMe,
    forgotPassword,
    resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import {
    validateLogin,
    validateRegister,
} from "../middlewares/validationMiddleware.js";
import { authRateLimit } from "../middlewares/rateLimitMiddleware.js";

// --- PUBLIC ROUTES (No token required) ---
router.route("/register").post(authRateLimit, validateRegister, registerUser);
router.route("/login").post(authRateLimit, validateLogin, loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(authRateLimit, forgotPassword);
router.route("/reset-password/:token").post(resetPassword);

// --- PROTECTED ROUTES (Requires valid access token) ---
router.route("/me").get(protect, getMe);
router.route("/logout").post(protect, logoutUser);
router.route("/logout-all").post(protect, logoutAll); 

export default router;