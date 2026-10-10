import mongoose from "mongoose";
import { madeOnce } from "../utils/saveOnce.js";

// A goal is something to reach, by a date or not: a few milestones to tick off on the way,
// and the routines and habits that carry it. It earns no XP and costs none.
const goalSchema = new mongoose.Schema({
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
    note: {
        type: String,
        default: "",
        trim: true,
    },
    targetDate: {
        type: String, // "YYYY-MM-DD", or null for a goal with no date
        default: null,
    },
    milestones: [
        {
            title: {
                type: String,
                required: true,
                trim: true,
            },
            done: {
                type: Boolean,
                default: false,
            },
            doneAt: {
                type: Date,
                default: null,
            },
        },
    ],
    // The routines and habits that work towards it
    links: [
        {
            _id: false,
            kind: {
                type: String,
                enum: ["routine", "habit"],
                required: true,
            },
            item: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
            },
        },
    ],
    reachedAt: {
        type: Date,
        default: null, // Set when its owner says it has been reached
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // Set while it is in Trash, see utils/trash.js
    deletedAt: {
        type: Date,
        default: null,
    },
    purgeAt: {
        type: Date,
        default: null,
    },
});

goalSchema.index({ user: 1, createdAt: 1 });

goalSchema.plugin(madeOnce);

const Goal = mongoose.model("Goal", goalSchema);
export default Goal;
