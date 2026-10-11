import mongoose from "mongoose";
import { madeOnce } from "../utils/saveOnce.js";

const habitSchema = new mongoose.Schema({
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
    category: {
        type: String,
        enum: ["health", "fitness", "learning", "personal", "work", "other"],
        default: "personal",
    },
    frequency: {
        type: String,
        enum: ["daily", "weekly"],
        default: "daily",
    },
    targetDays: {
        type: [Number], // [0,1,2,3,4,5,6] where 0=Sunday. Empty array = every day.
        default: [],
    },
    timeOfDay: {
        type: String,
        // A habit has no clock time. This is the part of the day it is listed under.
        enum: ["morning", "afternoon", "evening", "anytime"],
        default: "anytime",
    },
    order: {
        type: Number,
        default: 0, // Where it sits among the other habits in its part of the day. Lower comes first.
    },
    habitType: {
        type: String,
        enum: ["boolean", "quantity"],
        default: "boolean",
    },
    targetQuantity: {
        type: Number,
        default: 1,
    },
    unit: {
        type: String,
        default: "", // e.g., "glasses", "pages", "km"
    },
    difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
    },
    xpReward: {
        type: Number,
        default: 15,
    },
    currentStreak: {
        type: Number,
        default: 0,
    },
    bestStreak: {
        type: Number,
        default: 0,
    },
    totalCompletions: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
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
    // Retired: out of the plan for good, but kept in Archive with everything it did, and can be brought back.
    // isActive is false from the moment it is retired. See utils/itemArchive.js.
    archivedAt: {
        type: Date,
        default: null,
    },
    // The stretches of days it was off: paused, or in Archive. Not due on any of them, so they neither
    // cost XP nor break a run. Each is { from, until }, "YYYY-MM-DD", both days included. See utils/itemPause.js.
    pauses: {
        type: [
            {
                _id: false,
                from: { type: String, required: true },
                until: { type: String, required: true },
            },
        ],
        default: [],
    },
});

// Middleware: Automatically set the XP reward based on difficulty before saving
habitSchema.pre("save", function () {
    // Only run this if difficulty was modified or if it's a brand new document
    if (this.isModified("difficulty") || this.isNew) {
        if (this.difficulty === "easy") {
            this.xpReward = 10;
        } else if (this.difficulty === "hard") {
            this.xpReward = 25;
        } else {
            this.xpReward = 15; // medium
        }
    }
});

habitSchema.plugin(madeOnce);

const Habit = mongoose.model("Habit", habitSchema);
export default Habit;
