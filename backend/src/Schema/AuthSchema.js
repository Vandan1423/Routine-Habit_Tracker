import Joi from "joi";
import { TRASH_DAYS } from "../utils/trash.js";
import { END_REMINDER_LEADS, REMINDER_LEADS } from "../utils/reminderLeads.js";

export const registerSchema = Joi.object({
    name: Joi.string().min(2).max(50).required().trim().messages({
        "string.base": "Name must be a string.",
        "string.empty": "Name is required.",
        "string.min": "Name must be at least 2 characters long.",
        "string.max": "Name cannot exceed 50 characters.",
        "any.required": "Name is required.",
    }),

    email: Joi.string().email().required().lowercase().trim().messages({
        "string.base": "Email must be a string.",
        "string.empty": "Email is required.",
        "string.email": "Please provide a valid email address.",
        "any.required": "Email is required.",
    }),

    password: Joi.string().min(6).max(128).required().messages({
        "string.base": "Password must be a string.",
        "string.empty": "Password is required.",
        "string.min": "Password must be at least 6 characters long.",
        "string.max": "Password cannot exceed 128 characters.",
        "any.required": "Password is required.",
    }),
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required().lowercase().trim().messages({
        "string.base": "Email must be a string.",
        "string.empty": "Email is required.",
        "string.email": "Please provide a valid email address.",
        "any.required": "Email is required.",
    }),

    password: Joi.string().required().messages({
        "string.base": "Password must be a string.",
        "string.empty": "Password is required.",
        "any.required": "Password is required.",
    }),
});

export const forgotPasswordSchema = Joi.object({
    email: loginSchema.extract("email"),
});

// A new password follows the same rules as one chosen at registration
export const resetPasswordSchema = Joi.object({
    password: registerSchema.extract("password"),
});

export const resendVerificationSchema = Joi.object({
    email: loginSchema.extract("email"),
});

export const verificationTokenParamSchema = Joi.object({
    token: Joi.string()
        .pattern(/^[0-9a-f]{64}$/i)
        .required()
        .messages({
            "string.pattern.base":
                "This confirmation link is invalid or has expired.",
        }),
});

export const resetTokenParamSchema = Joi.object({
    token: Joi.string()
        .pattern(/^[0-9a-f]{64}$/i)
        .required()
        .messages({
            "string.pattern.base": "Invalid or expired reset token.",
        }),
});

// ── Changes a signed-in person makes to their own account ──

export const updateProfileSchema = Joi.object({
    name: registerSchema.extract("name").optional(),
    // How long Trash keeps what is deleted from now on
    trashDays: Joi.number().valid(...TRASH_DAYS),
    // Reminders: how many minutes before a routine, and whether open habits are nudged about
    reminderLead: Joi.number().valid(...REMINDER_LEADS),
    endReminderLead: Joi.number().valid(...END_REMINDER_LEADS).allow(null),
    remindHabits: Joi.boolean(),
    remindMoney: Joi.boolean(),
})
    .min(1)
    .messages({ "object.min": "No valid fields to update." });

// The password the account has now, asked for again before anything that could lock its owner out
const currentPassword = Joi.string().max(128).required().messages({
    "string.base": "Your current password must be a string.",
    "string.empty": "Enter your current password.",
    "string.max": "That isn't your current password.",
    "any.required": "Enter your current password.",
});

export const changePasswordSchema = Joi.object({
    currentPassword,
    newPassword: registerSchema.extract("password").messages({
        "string.base": "The new password must be a string.",
        "string.empty": "Choose a new password.",
        "string.min": "The new password must be at least 6 characters long.",
        "string.max": "The new password cannot exceed 128 characters.",
        "any.required": "Choose a new password.",
    }),
});

export const deleteAccountSchema = Joi.object({
    password: currentPassword,
});
