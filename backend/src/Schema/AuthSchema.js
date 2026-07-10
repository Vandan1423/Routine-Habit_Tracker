import Joi from "joi";

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
