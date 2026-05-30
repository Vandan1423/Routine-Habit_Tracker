import mongoose from "mongoose";

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

const Habit = mongoose.model("Habit", habitSchema);
export default Habit;
