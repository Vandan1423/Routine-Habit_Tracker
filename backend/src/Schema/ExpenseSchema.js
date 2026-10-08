import Joi from "joi";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import { NOTHING_TO_UPDATE, objectId } from "./CommonSchema.js";

const MAX_AMOUNT = 1000000000000;

const text = (max) => Joi.string().trim().max(max).allow("");
const optionalId = objectId.allow(null, "");

// Only the fields listed here can be set by a client. Ownership is decided by the server.
const transactionFields = {
    type: Joi.string().valid(...ExpenseTransaction.schema.path("type").enumValues),
    amount: Joi.number().positive().max(MAX_AMOUNT),
    category: text(60),
    description: text(500),
    paymentMethod: Joi.string().valid(
        ...ExpenseTransaction.schema.path("paymentMethod").enumValues,
    ),
    accountId: objectId,
    transferToAccountId: optionalId,
    placeName: text(120),
    notes: text(1000),
    subscriptionId: optionalId,
};

export const createTransactionSchema = Joi.object({
    ...transactionFields,
    amount: transactionFields.amount.required(),
    accountId: transactionFields.accountId.required(),
    // Left empty, the transaction is dated now
    transactionDate: Joi.date().iso().allow(null, ""),
});

export const updateTransactionSchema = Joi.object({
    ...transactionFields,
    transactionDate: Joi.date().iso(),
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);

const subscriptionFields = {
    name: Joi.string().trim().min(1).max(120),
    amount: Joi.number().min(0).max(MAX_AMOUNT),
    category: Joi.string().trim().min(1).max(60),
    frequency: Joi.string().valid(
        ...ExpenseSubscription.schema.path("frequency").enumValues,
    ),
    accountId: objectId,
    description: text(500),
    reminderDays: Joi.number().integer().min(0).max(365),
};

export const createSubscriptionSchema = Joi.object({
    ...subscriptionFields,
    name: subscriptionFields.name.required(),
    amount: subscriptionFields.amount.required(),
    accountId: subscriptionFields.accountId.required(),
    // Left empty, the subscription is due now
    nextDueDate: Joi.date().iso().allow(null, ""),
});

export const updateSubscriptionSchema = Joi.object({
    ...subscriptionFields,
    nextDueDate: Joi.date().iso(),
    isActive: Joi.boolean(),
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);

export const updateAccountSchema = Joi.object({
    name: Joi.string().trim().min(1).max(60),
    openingBalance: Joi.number().min(-MAX_AMOUNT).max(MAX_AMOUNT),
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);

export const upsertBudgetSchema = Joi.object({
    category: Joi.string().trim().min(1).max(60).required(),
    monthlyLimit: Joi.number().min(0).max(MAX_AMOUNT).required(),
    alertThreshold: Joi.number().min(0).max(1),
    isActive: Joi.boolean(),
});

export const placesQuerySchema = Joi.object({
    search: Joi.string().max(100).allow(""),
});

export const exportQuerySchema = Joi.object({
    month: Joi.string()
        .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
        .messages({
            "string.pattern.base": "{{#label}} must be a month in YYYY-MM format.",
        }),
});
