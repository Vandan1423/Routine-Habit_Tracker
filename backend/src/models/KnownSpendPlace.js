import mongoose from "mongoose";

const knownSpendPlaceSchema = new mongoose.Schema(
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
        normalizedName: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            default: "Other",
            trim: true,
        },
        transactionCount: {
            type: Number,
            default: 0,
        },
        totalSpent: {
            type: Number,
            default: 0,
        },
        lastVisitedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    },
);

knownSpendPlaceSchema.index({ user: 1, normalizedName: 1 }, { unique: true });

const KnownSpendPlace = mongoose.model(
    "KnownSpendPlace",
    knownSpendPlaceSchema,
);

export default KnownSpendPlace;