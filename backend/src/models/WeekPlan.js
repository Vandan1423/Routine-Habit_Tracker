import mongoose from "mongoose";

// What a week is for, beyond its days: a few things to focus on, notes, and how it went once it is over.
// One per account per week, kept under the week's first day as the person's own week starts.
// None of it earns or costs XP.
const focusSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    done: {
        type: Boolean,
        default: false,
    },
    // The goal it moves along, if any
    goal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Goal",
        default: null,
    },
});

const weekPlanSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // The week's first day, "YYYY-MM-DD"
        start: {
            type: String,
            required: true,
        },
        focus: {
            type: [focusSchema],
            default: [],
        },
        notes: {
            type: String,
            default: "",
        },
        // The review, written once the week is under way or over
        wentWell: {
            type: String,
            default: "",
        },
        better: {
            type: String,
            default: "",
        },
    },
    { timestamps: true },
);

weekPlanSchema.index({ user: 1, start: 1 }, { unique: true });

const WeekPlan = mongoose.model("WeekPlan", weekPlanSchema);
export default WeekPlan;
