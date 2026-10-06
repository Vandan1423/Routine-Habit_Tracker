import mongoose from "mongoose";

const expenseBudgetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        monthlyLimit: {
            type: Number,
            required: true,
            min: 0,
        },
        alertThreshold: {
            type: Number,
            default: 0.8,
            min: 0,
            max: 1,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    },
);

expenseBudgetSchema.index({ user: 1, category: 1 }, { unique: true });

const ExpenseBudget = mongoose.model("ExpenseBudget", expenseBudgetSchema);

export default ExpenseBudget;