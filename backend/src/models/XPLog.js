import mongoose from "mongoose";

const xpLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    reason: {
        type: String,
        required: true,
        trim: true, // e.g., "habit_complete", "streak_bonus"
    },
    metadata: {
        type: Object,
        default: {}, // Extremely useful for storing exactly which habit or routine triggered this
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Adding an index on user + createdAt makes fetching a user's recent activity feed blazing fast
xpLogSchema.index({ user: 1, createdAt: -1 });

const XPLog = mongoose.model("XPLog", xpLogSchema);
export default XPLog;
