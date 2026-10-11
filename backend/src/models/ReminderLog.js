import mongoose from "mongoose";

// The reminders already sent, so each goes out once however often the job looks.
// key names what it was about and for which day ("routine:<id>:2026-10-11"). Kept for a few days only.
const reminderLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    key: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3 * 24 * 60 * 60,
    },
});

// Claiming a reminder is creating its row: a second claim for the same one is refused
reminderLogSchema.index({ user: 1, key: 1 }, { unique: true });

const ReminderLog = mongoose.model("ReminderLog", reminderLogSchema);
export default ReminderLog;
