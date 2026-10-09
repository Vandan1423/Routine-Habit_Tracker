import mongoose from "mongoose";

// A to-do is a line on a list: something to get done once, with no day, no XP and no penalty.
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

const Todo = mongoose.model("Todo", todoSchema);
export default Todo;
