import mongoose from "mongoose";

const habitLogSchema = new mongoose.Schema({
    habit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Habit",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    date: {
        type: String, // Stored as "YYYY-MM-DD"
        required: true,
    },
    completed: {
        type: Boolean,
        default: true,
    },
    quantity: {
        type: Number,
        default: 1, // Relevant for quantity-type habits (e.g., drank 3 glasses of water)
    },
    note: {
        type: String,
        default: "",
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// CRITICAL: Prevent duplicate logs for the same habit on the same day
habitLogSchema.index({ habit: 1, date: 1 }, { unique: true });

const HabitLog = mongoose.model("HabitLog", habitLogSchema);
export default HabitLog;
