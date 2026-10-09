import express from "express";
const router = express.Router();
import {
    registerUser,
    loginUser,
    logoutUser,
    logoutAll,          
    refreshAccessToken,
    getMe,
    updateProfile,
    changePassword,
    deleteAccount,
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
    changePasswordSchema,
    deleteAccountSchema,
    forgotPasswordSchema,
    resendVerificationSchema,
    resetPasswordSchema,
    resetTokenParamSchema,
    updateProfileSchema,
    verificationTokenParamSchema,
} from "../Schema/AuthSchema.js";
import {
    authRateLimit,
    loginAccountRateLimit,
    passwordCheckRateLimit,
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
router
    .route("/me")
    .get(protect, getMe)
    .put(protect, validate({ body: updateProfileSchema }), updateProfile);
router
    .route("/password")
    .put(
        protect,
        validate({ body: changePasswordSchema }),
        passwordCheckRateLimit,
        changePassword,
    );
// A POST rather than DELETE /me: the password travels in the body, which not every proxy passes on for a DELETE
router
    .route("/delete-account")
    .post(
        protect,
        validate({ body: deleteAccountSchema }),
        passwordCheckRateLimit,
        deleteAccount,
    );
router.route("/logout").post(protect, logoutUser);
router.route("/logout-all").post(protect, logoutAll); 

export default router;