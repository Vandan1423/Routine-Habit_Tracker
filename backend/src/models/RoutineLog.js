import mongoose from "mongoose";

const routineLogSchema = new mongoose.Schema({
    routine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Routine",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    date: {
        type: String,
        required: true, // Format: "YYYY-MM-DD"
    },
    completedAt: {
        type: String,
        required: true, // Format: "HH:mm"
    },
    wasOnTime: {
        type: Boolean,
        default: true,
    },
    xpEarned: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index ensures one log per routine per day
routineLogSchema.index({ routine: 1, date: 1 }, { unique: true });

const RoutineLog = mongoose.model("RoutineLog", routineLogSchema);
export default RoutineLog;
