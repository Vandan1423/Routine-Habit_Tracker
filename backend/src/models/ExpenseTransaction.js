import mongoose from "mongoose";

const expenseTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["expense", "income", "transfer"],
            required: true,
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
        description: {
            type: String,
            default: "",
            trim: true,
        },
        paymentMethod: {
            type: String,
            enum: ["upi", "cash", "card", "bank_transfer", "other"],
            default: "other",
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExpenseAccount",
            required: true,
        },
        transferToAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExpenseAccount",
            default: null,
        },
        placeName: {
            type: String,
            default: "Other",
            trim: true,
        },
        transactionDate: {
            type: Date,
            default: Date.now,
        },
        monthKey: {
            type: String,
            default: "",
        },
        subscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExpenseSubscription",
            default: null,
        },
        notes: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    },
);

expenseTransactionSchema.pre("save", function () {
    const date = this.transactionDate || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    this.monthKey = `${year}-${month}`;
});

const ExpenseTransaction = mongoose.model(
    "ExpenseTransaction",
    expenseTransactionSchema,
);

export default ExpenseTransaction;