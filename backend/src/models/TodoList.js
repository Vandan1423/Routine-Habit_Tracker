import mongoose from "mongoose";
import { madeOnce } from "../utils/saveOnce.js";

const todoListSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    isDefault: {
        type: Boolean,
        default: false, // The one list every account has from the start. It cannot be renamed or deleted.
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

todoListSchema.index({ user: 1, createdAt: 1 });
// One general list per account, even when two requests try to make it at the same moment
todoListSchema.index(
    { user: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } },
);

todoListSchema.plugin(madeOnce);

const TodoList = mongoose.model("TodoList", todoListSchema);
export default TodoList;
