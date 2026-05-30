import mongoose from "mongoose";

const routineSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: "",
        trim: true,
    },
    date: {
        type: String, // We'll store it as "YYYY-MM-DD"
        default: null,
    },
    startTime: {
        type: String, // Stored as "HH:MM" (e.g., "04:00")
        required: true,
    },
    endTime: {
        type: String,
        default: "",
    },
    category: {
        type: String,
        enum: ["health", "work", "personal", "learning", "fitness", "other"],
        default: "personal",
    },
    isRecurring: {
        type: Boolean,
        default: false,
    },
    recurringDays: {
        type: [Number], // [0,1,2,3,4,5,6] where 0 = Sunday, 1 = Monday, etc.
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    order: {
        type: Number,
        default: 0, // For drag-and-drop UI ordering
    },
    xpReward: {
        type: Number,
        default: 10,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Routine = mongoose.model("Routine", routineSchema);
export default Routine;
