import mongoose from "mongoose";

const expenseSubscriptionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        category: {
            type: String,
            default: "Other",
            trim: true,
        },
        frequency: {
            type: String,
            enum: ["weekly", "monthly", "yearly"],
            default: "monthly",
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExpenseAccount",
            required: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        nextDueDate: {
            type: Date,
            default: Date.now,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        reminderDays: {
            type: Number,
            default: 3,
        },
        // Set while it is in Trash, see utils/trash.js
        deletedAt: {
            type: Date,
            default: null,
        },
        purgeAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

const ExpenseSubscription = mongoose.model(
    "ExpenseSubscription",
    expenseSubscriptionSchema,
);

export default ExpenseSubscription;