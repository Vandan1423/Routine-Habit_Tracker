import Goal from "../models/Goal.js";
import WeekPlan from "../models/WeekPlan.js";
import { KEPT } from "../utils/trash.js";

// What a week is for beyond its days (see models/WeekPlan.js). The days themselves are routines, habits
// and planned to-dos, each read where it lives.

// A week nothing has been written for yet, as it is sent
const emptyWeek = (start) => ({ start, focus: [], notes: "", wentWell: "", better: "" });

// @desc    One week's focus, notes and review
// @route   GET /api/weeks/:start
export const getWeek = async (req, res, next) => {
    try {
        const { start } = req.params;
        const week = await WeekPlan.findOne({ user: req.user._id, start });

        res.status(200).json({ week: week ?? emptyWeek(start) });
    } catch (error) {
        next(error);
    }
};

// @desc    Write any of a week's focus, notes and review, making the week's record the first time
// @route   PUT /api/weeks/:start
export const updateWeek = async (req, res, next) => {
    try {
        const { start } = req.params;
        const { focus, notes, wentWell, better } = req.body;
        const changes = {};

        if (focus !== undefined) {
            // A goal it names has to be one of this account's, and not in Trash
            const goalIds = [...new Set(focus.map((entry) => entry.goalId).filter(Boolean))];
            if (goalIds.length > 0) {
                const found = await Goal.countDocuments({ _id: { $in: goalIds }, user: req.user._id, ...KEPT });
                if (found !== goalIds.length) return res.status(404).json({ message: "Goal not found" });
            }

            changes.focus = focus.map(({ _id, title, done, goalId }) => ({
                ...(_id ? { _id } : {}),
                title,
                done,
                goal: goalId ?? null,
            }));
        }
        if (notes !== undefined) changes.notes = notes;
        if (wentWell !== undefined) changes.wentWell = wentWell;
        if (better !== undefined) changes.better = better;

        const write = () =>
            WeekPlan.findOneAndUpdate(
                { user: req.user._id, start },
                { $set: changes, $setOnInsert: { user: req.user._id, start } },
                { upsert: true, returnDocument: "after", runValidators: true },
            );

        let week;
        try {
            week = await write();
        } catch (error) {
            // Two first writes of the same week at the same moment: the second finds the first's record
            if (error?.code !== 11000) throw error;
            week = await write();
        }

        res.status(200).json({ week });
    } catch (error) {
        next(error);
    }
};
