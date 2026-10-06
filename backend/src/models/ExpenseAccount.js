import mongoose from "mongoose";

const expenseAccountSchema = new mongoose.Schema(
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
        type: {
            type: String,
            enum: ["bank", "cash"],
            required: true,
        },
        openingBalance: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: "INR",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    },
);

const ExpenseAccount = mongoose.model("ExpenseAccount", expenseAccountSchema);

export default ExpenseAccount;