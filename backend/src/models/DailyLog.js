import mongoose from "mongoose";

const dailyLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    date: {
        type: String,
        required: true, // Format: "YYYY-MM-DD"
    },
    totalRoutines: {
        type: Number,
        default: 0, // How many routines were active/scheduled for this day
    },
    completedRoutines: {
        type: Number,
        default: 0, // How many of those routines were marked completed
    },
    totalHabits: {
        type: Number,
        default: 0, // How many habits were scheduled for this day
    },
    completedHabits: {
        type: Number,
        default: 0, // How many habits hit their target completion threshold
    },
    isPerfectDay: {
        type: Boolean,
        default: false, // True only if something was due and every routine and habit due was done
    },
    isRestDay: {
        type: Boolean,
        default: false, // True if nothing was due: such a day neither adds to the account's run nor ends it
    },
    xpEarned: {
        type: Number,
        default: 0, // Total XP accumulated from all sources on this day
    },
    streakDay: {
        type: Number,
        default: 0, // The running perfect-day streak counter at the time of this log
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound unique index ensures one summary snapshot per user per day
dailyLogSchema.index({ user: 1, date: 1 }, { unique: true });

const DailyLog = mongoose.model("DailyLog", dailyLogSchema);
export default DailyLog;
