import TodoList from "../models/TodoList.js";
import Todo from "../models/Todo.js";
import { generalListOf } from "../utils/todoLists.js";
import { KEPT, trashStamp } from "../utils/trash.js";

// To-do lists: one general list every account has, and any number of named ones.
// A to-do earns no XP, costs none, and has no part in the day's standing or the account's run.

// The most lists an account may keep, and the most to-dos on one list
const MOST_LISTS = 50;
const MOST_TODOS = 500;

const ownList = (userId, listId) => TodoList.findOne({ _id: listId, user: userId, ...KEPT });

// A list as it is sent: with what is on it, the oldest first
const withTodos = (list, todos) => ({
    ...list.toObject(),
    todos: todos.filter((todo) => todo.list.toString() === list._id.toString()),
});

// @desc    Every list with its to-dos: the general list first, then the named ones in the order they were made
// @route   GET /api/todos
export const getTodos = async (req, res, next) => {
    try {
        const general = await generalListOf(req.user._id);

        const [named, todos] = await Promise.all([
            TodoList.find({ user: req.user._id, isDefault: false, ...KEPT }).sort({ createdAt: 1 }),
            Todo.find({ user: req.user._id, ...KEPT }).sort({ createdAt: 1 }),
        ]);

        res.status(200).json({
            lists: [general, ...named].map((list) => withTodos(list, todos)),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Make a named list
// @route   POST /api/todos/lists
export const createList = async (req, res, next) => {
    try {
        const count = await TodoList.countDocuments({ user: req.user._id, ...KEPT });
        if (count >= MOST_LISTS) {
            return res.status(400).json({ message: `At most ${MOST_LISTS} lists can be kept.` });
        }

        const list = await TodoList.create({ user: req.user._id, name: req.body.name });

        res.status(201).json({ list: withTodos(list, []) });
    } catch (error) {
        next(error);
    }
};

// @desc    Rename a list
// @route   PUT /api/todos/lists/:id
export const updateList = async (req, res, next) => {
    try {
        const list = await ownList(req.user._id, req.params.id);
        if (!list) return res.status(404).json({ message: "List not found" });

        if (list.isDefault) {
            return res.status(400).json({ message: "The general list keeps its name." });
        }

        list.name = req.body.name;
        await list.save();

        res.status(200).json({ list });
    } catch (error) {
        next(error);
    }
};

// @desc    Move a list to Trash, with everything on it
// @route   DELETE /api/todos/lists/:id
export const deleteList = async (req, res, next) => {
    try {
        const list = await ownList(req.user._id, req.params.id);
        if (!list) return res.status(404).json({ message: "List not found" });

        if (list.isDefault) {
            return res.status(400).json({ message: "The general list cannot be deleted." });
        }

        // The list and what is on it share one stamp, and so leave Trash together
        const stamp = trashStamp(req.user);
        list.set(stamp);
        await list.save();
        const moved = await Todo.updateMany(
            { user: req.user._id, list: list._id, ...KEPT },
            { $set: { ...stamp, withList: true } },
        );

        res.status(200).json({
            message: "List moved to Trash",
            id: req.params.id,
            purgeAt: list.purgeAt,
            todos: moved.modifiedCount,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Move every finished to-do on a list to Trash
// @route   POST /api/todos/lists/:id/clear
export const clearDone = async (req, res, next) => {
    try {
        const list = await ownList(req.user._id, req.params.id);
        if (!list) return res.status(404).json({ message: "List not found" });

        const finished = await Todo.find({
            user: req.user._id,
            list: list._id,
            done: true,
            ...KEPT,
        }).select("_id");
        const ids = finished.map((todo) => todo._id);

        const stamp = trashStamp(req.user);
        await Todo.updateMany({ _id: { $in: ids } }, { $set: stamp });

        res.status(200).json({ ids, purgeAt: stamp.purgeAt });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a to-do to a list
// @route   POST /api/todos
export const createTodo = async (req, res, next) => {
    try {
        const list = req.body.listId
            ? await ownList(req.user._id, req.body.listId)
            : await generalListOf(req.user._id);
        if (!list) return res.status(404).json({ message: "List not found" });

        const count = await Todo.countDocuments({ user: req.user._id, list: list._id, ...KEPT });
        if (count >= MOST_TODOS) {
            return res.status(400).json({ message: `A list holds at most ${MOST_TODOS} to-dos.` });
        }

        const todo = await Todo.create({
            user: req.user._id,
            list: list._id,
            title: req.body.title,
        });

        res.status(201).json({ todo });
    } catch (error) {
        next(error);
    }
};

// @desc    Change a to-do: its words, whether it is done, or the list it is on
// @route   PUT /api/todos/:id
export const updateTodo = async (req, res, next) => {
    try {
        const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id, ...KEPT });
        if (!todo) return res.status(404).json({ message: "To-do not found" });

        const { title, done, listId } = req.body;

        if (listId !== undefined && listId !== todo.list.toString()) {
            const list = await ownList(req.user._id, listId);
            if (!list) return res.status(404).json({ message: "List not found" });
            todo.list = list._id;
        }
        if (title !== undefined) todo.title = title;
        if (done !== undefined && done !== todo.done) {
            todo.done = done;
            todo.doneAt = done ? new Date() : null;
        }
        await todo.save();

        res.status(200).json({ todo });
    } catch (error) {
        next(error);
    }
};

// @desc    Move a to-do to Trash
// @route   DELETE /api/todos/:id
export const deleteTodo = async (req, res, next) => {
    try {
        const todo = await Todo.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, ...KEPT },
            { $set: { ...trashStamp(req.user), withList: false } },
            { returnDocument: "after" },
        );
        if (!todo) return res.status(404).json({ message: "To-do not found" });

        res.status(200).json({
            message: "To-do moved to Trash",
            id: req.params.id,
            purgeAt: todo.purgeAt,
        });
    } catch (error) {
        next(error);
    }
};
