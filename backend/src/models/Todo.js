import mongoose from "mongoose";
import { madeOnce } from "../utils/saveOnce.js";

// A to-do is a line on a list: something to get done once, with no XP and no penalty. It may be planned
// for a day of the week (Week), and at a time on that day; one with no day waits on its list until it is.
// A planned one left undone stays on its day: nothing moves it but the person.
const todoSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    list: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TodoList",
        required: true,
    },
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
    // The day it is planned for, "YYYY-MM-DD" in the account's own timezone, or null for none
    date: {
        type: String,
        default: null,
    },
    // When on that day, "HH:MM" on a 24-hour clock, and when it ends; both null for any time of the day.
    // An end is only kept with a start.
    time: {
        type: String,
        default: null,
    },
    endTime: {
        type: String,
        default: null,
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
    withList: {
        type: Boolean,
        default: false, // It went into Trash as part of its list, and comes back with the list, not by itself
    },
});

todoSchema.index({ user: 1, list: 1, createdAt: 1 });
// A week of planned to-dos, read by Week
todoSchema.index({ user: 1, date: 1 });

todoSchema.plugin(madeOnce);

const Todo = mongoose.model("Todo", todoSchema);
export default Todo;
