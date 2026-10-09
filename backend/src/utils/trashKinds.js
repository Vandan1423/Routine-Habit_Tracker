import Routine from "../models/Routine.js";
import Habit from "../models/Habit.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import TodoList from "../models/TodoList.js";
import Todo from "../models/Todo.js";
import Goal from "../models/Goal.js";
import { ITEM_IN_TRASH, restoreItemFromTrash } from "./itemTrash.js";
import { generalListOf } from "./todoLists.js";
import { IN_TRASH, OUT_OF_TRASH } from "./trash.js";

// Everything that can be in Trash, by kind. Each kind says how its things are found there, what is shown
// of one, how one is brought back exactly as it was, and how one is let go of for good.
//
//   find(userId)          - what the user has in Trash, as documents
//   describe(doc)         - what the Trash screen is told about one, beside its id and dates
//   restore(user, id)     - brings one back; null if the user has no such thing in Trash.
//                           May answer { refused: "why" } when it cannot come back as things stand.
//   erase(filter)         - lets go of everything in Trash that matches, for good; returns how many

const dayOf = (date) => new Date(date).toISOString().slice(0, 10);

// A routine or habit that is let go of keeps a bare record: the days it was done or missed on still name it.
// It leaves Trash, cannot be recovered, and the XP that went with it stays gone.
const itemKind = (model, kind, describe) => ({
    find: (userId) => model.find({ user: userId, ...ITEM_IN_TRASH }),
    describe: (item) => ({ title: item.title, xp: item.xpHeld || 0, ...describe(item) }),
    restore: async (user, id) => {
        const restored = await restoreItemFromTrash(user, kind, id);
        return restored && { item: restored.item, xpReturned: restored.xpReturned };
    },
    erase: async (filter, now = new Date()) =>
        (await model.updateMany({ ...ITEM_IN_TRASH, ...filter }, { $set: { purgedAt: now } })).modifiedCount,
});

// Anything else is simply removed
const plainKind = (model, { find, describe }) => ({
    find: find ?? ((userId) => model.find({ user: userId, ...IN_TRASH })),
    describe,
    restore: async (user, id) => {
        const item = await model.findOneAndUpdate(
            { _id: id, user: user._id, ...IN_TRASH },
            { $set: OUT_OF_TRASH },
            { returnDocument: "after" },
        );
        return item && { item };
    },
    erase: async (filter) => (await model.deleteMany({ ...IN_TRASH, ...filter })).deletedCount,
});

export const TRASH_KINDS = {
    routine: itemKind(Routine, "routine", (routine) => ({
        isRecurring: routine.isRecurring,
        recurringDays: routine.recurringDays,
        date: routine.date,
        startTime: routine.startTime,
        endTime: routine.endTime,
    })),

    habit: itemKind(Habit, "habit", (habit) => ({
        frequency: habit.frequency,
        targetDays: habit.targetDays,
        timeOfDay: habit.timeOfDay,
    })),

    transaction: plainKind(ExpenseTransaction, {
        find: (userId) =>
            ExpenseTransaction.find({ user: userId, ...IN_TRASH })
                .populate("account", "name")
                .populate("transferToAccount", "name"),
        describe: (transaction) => ({
            title: transaction.description || "",
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            placeName: transaction.placeName,
            date: dayOf(transaction.transactionDate),
            account: transaction.account?.name ?? "",
            toAccount: transaction.transferToAccount?.name ?? "",
        }),
    }),

    subscription: plainKind(ExpenseSubscription, {
        describe: (subscription) => ({
            title: subscription.name,
            amount: subscription.amount,
            frequency: subscription.frequency,
        }),
    }),

    // A to-do deleted by itself. One that went in with its list is part of the list's entry instead.
    todo: {
        find: (userId) =>
            Todo.find({ user: userId, withList: false, ...IN_TRASH }).populate("list", "name isDefault"),
        describe: (todo) => ({
            title: todo.title,
            done: todo.done,
            list: todo.list ? { name: todo.list.name, isDefault: todo.list.isDefault } : null,
        }),
        restore: async (user, id) => {
            const todo = await Todo.findOne({ _id: id, user: user._id, withList: false, ...IN_TRASH });
            if (!todo) return null;

            const list = await TodoList.findOne({ _id: todo.list, user: user._id });
            if (list?.deletedAt) {
                return { refused: "Its list is in Trash. Recover the list first." };
            }
            // Its list has been let go of for good: it goes on the general list
            if (!list) todo.list = (await generalListOf(user._id))._id;

            todo.set(OUT_OF_TRASH);
            await todo.save();
            return { item: todo };
        },
        erase: async (filter) =>
            (await Todo.deleteMany({ withList: false, ...IN_TRASH, ...filter })).deletedCount,
    },

    todoList: {
        find: async (userId) => {
            const lists = await TodoList.find({ user: userId, ...IN_TRASH });
            const counts = await Todo.aggregate([
                { $match: { list: { $in: lists.map((list) => list._id) }, withList: true } },
                { $group: { _id: "$list", count: { $sum: 1 } } },
            ]);
            const countOf = new Map(counts.map((entry) => [entry._id.toString(), entry.count]));

            // describe() is handed plain documents, so the count rides along on a field of its own
            return lists.map((list) => Object.assign(list, { $todoCount: countOf.get(list._id.toString()) ?? 0 }));
        },
        describe: (list) => ({ title: list.name, todos: list.$todoCount ?? 0 }),
        // The list comes back with everything that went into Trash with it
        restore: async (user, id) => {
            const list = await TodoList.findOneAndUpdate(
                { _id: id, user: user._id, ...IN_TRASH },
                { $set: OUT_OF_TRASH },
                { returnDocument: "after" },
            );
            if (!list) return null;

            await Todo.updateMany(
                { user: user._id, list: list._id, withList: true },
                { $set: { ...OUT_OF_TRASH, withList: false } },
            );
            return { item: list };
        },
        erase: async (filter) => {
            const lists = await TodoList.find({ ...IN_TRASH, ...filter }).select("_id");
            if (lists.length === 0) return 0;

            const ids = lists.map((list) => list._id);
            await Todo.deleteMany({ list: { $in: ids }, withList: true });
            return (await TodoList.deleteMany({ _id: { $in: ids } })).deletedCount;
        },
    },

    goal: plainKind(Goal, {
        describe: (goal) => ({
            title: goal.title,
            targetDate: goal.targetDate,
            milestones: goal.milestones.length,
        }),
    }),
};

/**
 * Lets go of everything whose time in Trash has run out.
 * @param {Object} [options]
 * @param {String} [options.userId] - only this account's; everyone's when left out
 * @returns {Number} - how many things went
 */
export const purgeExpiredTrash = async ({ userId, now = new Date() } = {}) => {
    const filter = { purgeAt: { $lte: now }, ...(userId ? { user: userId } : {}) };
    let gone = 0;

    for (const kind of Object.values(TRASH_KINDS)) {
        gone += await kind.erase(filter, now);
    }
    return gone;
};
