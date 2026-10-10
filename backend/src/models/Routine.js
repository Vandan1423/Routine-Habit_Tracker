import mongoose from "mongoose";
import { madeOnce } from "../utils/saveOnce.js";

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
    // Where it stands once deleted, see utils/trash.js. isActive is false from the moment it is in Trash.
    deletedAt: {
        type: Date,
        default: null, // When it was moved to Trash
    },
    purgeAt: {
        type: Date,
        default: null, // When Trash lets go of it
    },
    purgedAt: {
        type: Date,
        default: null, // When Trash did let go: it can no longer be recovered, and only past days still name it
    },
    xpHeld: {
        type: Number,
        default: 0, // The XP it had earned, taken from the account while it is in Trash and given back if it is recovered
    },
});

routineSchema.plugin(madeOnce);

const Routine = mongoose.model("Routine", routineSchema);
export default Routine;
