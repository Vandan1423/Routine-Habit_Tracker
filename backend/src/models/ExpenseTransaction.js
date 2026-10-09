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

// A transaction date is a calendar day stored at UTC midnight, so its month is read in UTC.
// Reading it in the server's own timezone would shift days near a month boundary.
expenseTransactionSchema.pre("save", function () {
    const date = this.transactionDate || new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    this.monthKey = `${year}-${month}`;
});

const ExpenseTransaction = mongoose.model(
    "ExpenseTransaction",
    expenseTransactionSchema,
);

export default ExpenseTransaction;