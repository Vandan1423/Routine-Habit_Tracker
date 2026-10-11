import User from "../models/User.js";
import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import DailyLog from "../models/DailyLog.js";
import XPLog from "../models/XPLog.js";
import ExpenseAccount from "../models/ExpenseAccount.js";
import ExpenseBudget from "../models/ExpenseBudget.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import KnownSpendPlace from "../models/KnownSpendPlace.js";
import TodoList from "../models/TodoList.js";
import Todo from "../models/Todo.js";
import Goal from "../models/Goal.js";
import PushSubscription from "../models/PushSubscription.js";
import ReminderLog from "../models/ReminderLog.js";

// Everything that belongs to one account. Each of these names its owner in a `user` field.
// A new model that holds a person's data has to be added here; test/unit/eraseAccount.test.js fails until it is.
export const OWNED_MODELS = [
    Routine,
    RoutineLog,
    Habit,
    HabitLog,
    DailyLog,
    XPLog,
    ExpenseAccount,
    ExpenseBudget,
    ExpenseSubscription,
    ExpenseTransaction,
    KnownSpendPlace,
    TodoList,
    Todo,
    Goal,
    PushSubscription,
    ReminderLog,
];

/**
 * Removes an account and all that it holds, for good.
 * The account itself goes last: if anything fails on the way, it is still there to sign in to and try again.
 */
const eraseAccount = async (userId) => {
    await Promise.all(OWNED_MODELS.map((model) => model.deleteMany({ user: userId })));
    await User.deleteOne({ _id: userId });
};

export default eraseAccount;
