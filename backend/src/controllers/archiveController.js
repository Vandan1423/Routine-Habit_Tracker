import Routine from "../models/Routine.js";
import RoutineLog from "../models/RoutineLog.js";
import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { ITEM_IN_ARCHIVE } from "../utils/itemArchive.js";

// Archive: the routines and habits that have been retired. They are kept for good, with their history,
// and each can be brought back into the plan through its own route (POST /api/routines/:id/unarchive).

// How many times each of a set of items was done: id (as text) => count
const timesDone = async (logModel, field, ids, match = {}) => {
    if (ids.length === 0) return new Map();

    const counts = await logModel.aggregate([
        { $match: { [field]: { $in: ids }, ...match } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    return new Map(counts.map((entry) => [entry._id.toString(), entry.count]));
};

const newestFirst = (a, b) => b.archivedAt - a.archivedAt;

// @desc    Everything retired, as the routes for the plan send it, with how many times each was done.
//          The most recently retired first.
// @route   GET /api/archive
export const getArchive = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const [routines, habits] = await Promise.all([
            Routine.find({ user: userId, ...ITEM_IN_ARCHIVE }),
            Habit.find({ user: userId, ...ITEM_IN_ARCHIVE }),
        ]);
        const [routinesDone, habitsDone] = await Promise.all([
            timesDone(RoutineLog, "routine", routines.map((routine) => routine._id), { user: userId }),
            timesDone(HabitLog, "habit", habits.map((habit) => habit._id), { user: userId, completed: true }),
        ]);

        const withTotals = (items, done) =>
            items.sort(newestFirst).map((item) => ({
                ...item.toObject(),
                timesDone: done.get(item._id.toString()) ?? 0,
            }));

        res.status(200).json({
            routines: withTotals(routines, routinesDone),
            habits: withTotals(habits, habitsDone),
        });
    } catch (error) {
        next(error);
    }
};
