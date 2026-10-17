import TodoList from "../models/TodoList.js";
import Todo from "../models/Todo.js";
import { addDays, getUserToday } from "../utils/dateRules.js";
import { generalListOf } from "../utils/todoLists.js";
import { keyOf, saveOnce } from "../utils/saveOnce.js";
import { KEPT, trashStamp } from "../utils/trash.js";

// To-do lists: one general list every account has, and any number of named ones.
// A to-do earns no XP, costs none, and has no part in the day's standing or the account's run.
// One can be planned for a day (and a time), which is how Week lays out what each day is for.

// The most lists an account may keep, and the most to-dos on one list. A planned one that is finished is
// part of the record of its week, not something left to do, so it does not count towards a list's room.
const MOST_LISTS = 50;
const MOST_TODOS = 500;
const TAKING_ROOM = { $or: [{ date: null }, { done: false }] };

// The lists carry what is planned and finished for this many days back; Week reads earlier weeks by range
const PLANNED_KEPT_DAYS = 42;
const KEPT_ON_LISTS = (today) => ({
    $or: [{ date: null }, { done: false }, { date: { $gte: addDays(today, -(PLANNED_KEPT_DAYS - 1)) } }],
});

const NOT_IN_THE_PAST = "A to-do can be planned for today or a day still to come.";
const END_AFTER_START = "The end has to come after the start.";

/**
 * Whether a to-do's day and times, as they would stand after a change, can be kept. Returns what is
 * wrong, or null. A day that is not changing may be in the past (it was planned before it passed).
 */
const planProblem = ({ date, time, endTime }, { today, dateChanged }) => {
    if (date && dateChanged && date < today) return NOT_IN_THE_PAST;
    if (time && !date) return "A time needs a day.";
    if (endTime && !time) return "An end needs a start.";
    if (time && endTime && endTime <= time) return END_AFTER_START;
    return null;
};

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
            Todo.find({ user: req.user._id, ...KEPT, ...KEPT_ON_LISTS(getUserToday(req.user)) }).sort({
                createdAt: 1,
            }),
        ]);

        res.status(200).json({
            lists: [general, ...named].map((list) => withTodos(list, todos)),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    The to-dos planned for the days from one date to another, finished or not, on any list
// @route   GET /api/todos/planned?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getPlanned = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const todos = await Todo.find({ user: req.user._id, ...KEPT, date: { $gte: from, $lte: to } }).sort({
            createdAt: 1,
        });

        res.status(200).json({ from, to, todos });
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

        const { doc: list } = await saveOnce(new TodoList({ user: req.user._id, name: req.body.name }), keyOf(req));

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

        const { date = null, time = null, endTime = null } = req.body;
        const problem = planProblem(
            { date, time, endTime },
            { today: getUserToday(req.user), dateChanged: true },
        );
        if (problem) return res.status(400).json({ message: problem });

        const count = await Todo.countDocuments({ user: req.user._id, list: list._id, ...KEPT, ...TAKING_ROOM });
        if (count >= MOST_TODOS) {
            return res.status(400).json({ message: `A list holds at most ${MOST_TODOS} to-dos.` });
        }

        const { doc: todo } = await saveOnce(
            new Todo({
                user: req.user._id,
                list: list._id,
                title: req.body.title,
                date,
                time,
                endTime,
            }),
            keyOf(req),
        );

        res.status(201).json({ todo });
    } catch (error) {
        next(error);
    }
};

// @desc    Change a to-do: its words, whether it is done, the list it is on, or the day and time it is planned for
// @route   PUT /api/todos/:id
export const updateTodo = async (req, res, next) => {
    try {
        const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id, ...KEPT });
        if (!todo) return res.status(404).json({ message: "To-do not found" });

        const { title, done, listId } = req.body;

        // Its day and times as they would stand. A field left out keeps what it has, except that taking away
        // the day takes its time with it, and taking away the start takes the end.
        const has = (field) => req.body[field] !== undefined;
        if (has("date") || has("time") || has("endTime")) {
            const date = has("date") ? req.body.date : todo.date;
            const time = has("time") ? req.body.time : date ? todo.time : null;
            const endTime = has("endTime") ? req.body.endTime : time ? todo.endTime : null;

            const problem = planProblem(
                { date, time, endTime },
                { today: getUserToday(req.user), dateChanged: date !== todo.date },
            );
            if (problem) return res.status(400).json({ message: problem });

            todo.date = date;
            todo.time = time;
            todo.endTime = endTime;
        }

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
