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
    verifyEmail,
    resendVerification,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import {
    validate,
    validateLogin,
    validateRegister,
} from "../middlewares/validationMiddleware.js";
import {
    forgotPasswordSchema,
    resendVerificationSchema,
    resetPasswordSchema,
    resetTokenParamSchema,
    verificationTokenParamSchema,
} from "../Schema/AuthSchema.js";
import {
    authRateLimit,
    loginAccountRateLimit,
    passwordResetRateLimit,
    verificationEmailRateLimit,
} from "../middlewares/rateLimitMiddleware.js";

// --- PUBLIC ROUTES (No token required) ---
router
    .route("/register")
    .post(
        authRateLimit,
        validateRegister,
        verificationEmailRateLimit,
        registerUser,
    );
router
    .route("/verify-email/:token")
    .post(
        authRateLimit,
        validate({ params: verificationTokenParamSchema }),
        verifyEmail,
    );
router
    .route("/resend-verification")
    .post(
        authRateLimit,
        validate({ body: resendVerificationSchema }),
        verificationEmailRateLimit,
        resendVerification,
    );
router
    .route("/login")
    .post(authRateLimit, validateLogin, loginAccountRateLimit, loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router
    .route("/forgot-password")
    .post(
        authRateLimit,
        validate({ body: forgotPasswordSchema }),
        passwordResetRateLimit,
        forgotPassword,
    );
router
    .route("/reset-password/:token")
    .post(
        validate({ params: resetTokenParamSchema, body: resetPasswordSchema }),
        resetPassword,
    );

// --- PROTECTED ROUTES (Requires valid access token) ---
router.route("/me").get(protect, getMe);
router.route("/logout").post(protect, logoutUser);
router.route("/logout-all").post(protect, logoutAll); 

export default router;