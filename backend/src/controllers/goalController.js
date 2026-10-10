import Goal from "../models/Goal.js";
import Routine from "../models/Routine.js";
import Habit from "../models/Habit.js";
import { getUserToday } from "../utils/dateRules.js";
import { KEPT, trashStamp } from "../utils/trash.js";
import { keyOf, saveOnce } from "../utils/saveOnce.js";

// Goals: something to reach, with milestones to tick off and the routines and habits that carry it.
// A goal earns no XP and costs none. How its routines and habits are being kept is read by the client
// from the history routes; nothing about that is stored here.

const MOST_GOALS = 100;

/**
 * The routines and habits a set of goals names, as "kind:id" => what to show for it.
 * Asking with the owner as well means an id that belongs to someone else names nothing.
 */
const linkedItems = async (userId, goals) => {
    const idsOf = (kind) => [
        ...new Set(
            goals.flatMap((goal) =>
                goal.links.filter((link) => link.kind === kind).map((link) => link.item.toString()),
            ),
        ),
    ];
    const routineIds = idsOf("routine");
    const habitIds = idsOf("habit");

    const [routines, habits] = await Promise.all([
        routineIds.length
            ? Routine.find({ _id: { $in: routineIds }, user: userId }).select("title isActive isRecurring")
            : [],
        habitIds.length
            ? Habit.find({ _id: { $in: habitIds }, user: userId }).select("title isActive")
            : [],
    ]);

    const items = new Map();
    for (const routine of routines) items.set(`routine:${routine._id}`, routine);
    for (const habit of habits) items.set(`habit:${habit._id}`, habit);
    return items;
};

// A goal as it is sent. A linked item that has been deleted is still listed, marked as no longer in the plan.
const present = (goal, items) => ({
    _id: goal._id,
    title: goal.title,
    note: goal.note,
    targetDate: goal.targetDate,
    reachedAt: goal.reachedAt,
    createdAt: goal.createdAt,
    milestones: goal.milestones.map((milestone) => ({
        id: milestone._id,
        title: milestone.title,
        done: milestone.done,
        doneAt: milestone.doneAt,
    })),
    links: goal.links
        .map((link) => {
            const item = items.get(`${link.kind}:${link.item}`);
            return item
                ? { kind: link.kind, id: link.item, title: item.title, active: Boolean(item.isActive) }
                : null;
        })
        .filter(Boolean),
});

const presentOne = async (userId, goal) => present(goal, await linkedItems(userId, [goal]));

/**
 * The links a request asks for, kept only where they name the user's own routines and habits.
 * @returns {Array|null} - null when one of them names nothing of theirs
 */
const ownLinks = async (userId, links) => {
    const idsOf = (kind) => links.filter((link) => link.kind === kind).map((link) => link.id);
    const [routines, habits] = await Promise.all([
        Routine.countDocuments({ _id: { $in: idsOf("routine") }, user: userId, isActive: true }),
        Habit.countDocuments({ _id: { $in: idsOf("habit") }, user: userId, isActive: true }),
    ]);

    if (routines + habits !== links.length) return null;
    return links.map((link) => ({ kind: link.kind, item: link.id }));
};

/**
 * The milestones a request sends, set against the ones the goal already has: one named by its id keeps
 * the moment it was done unless that changes; one without an id is new. The order sent is the order kept.
 */
const mergeMilestones = (existing, sent, now = new Date()) =>
    sent.map((milestone) => {
        const before = milestone.id ? existing.id(milestone.id) : null;
        const done = milestone.done ?? before?.done ?? false;

        return {
            ...(before ? { _id: before._id } : {}),
            title: milestone.title,
            done,
            doneAt: done ? (before?.done ? before.doneAt : now) : null,
        };
    });

// @desc    Every goal: the ones still open first, the soonest date first, then the ones reached
// @route   GET /api/goals
export const getGoals = async (req, res, next) => {
    try {
        const goals = await Goal.find({ user: req.user._id, ...KEPT }).sort({ createdAt: 1 });
        const items = await linkedItems(req.user._id, goals);

        const rank = (goal) => [goal.reachedAt ? 1 : 0, goal.targetDate ?? "9999-99-99"];
        goals.sort((a, b) => {
            const [reachedA, dateA] = rank(a);
            const [reachedB, dateB] = rank(b);
            return reachedA - reachedB || dateA.localeCompare(dateB) || a.createdAt - b.createdAt;
        });

        res.status(200).json({
            today: getUserToday(req.user),
            goals: goals.map((goal) => present(goal, items)),
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Set a goal
// @route   POST /api/goals
export const createGoal = async (req, res, next) => {
    try {
        const { title, note, targetDate, milestones = [], links = [] } = req.body;

        const count = await Goal.countDocuments({ user: req.user._id, ...KEPT });
        if (count >= MOST_GOALS) {
            return res.status(400).json({ message: `At most ${MOST_GOALS} goals can be kept.` });
        }

        const owned = await ownLinks(req.user._id, links);
        if (!owned) {
            return res.status(404).json({ message: "A linked routine or habit was not found." });
        }

        const made = new Goal({ user: req.user._id, title, note, targetDate, links: owned });
        made.milestones = mergeMilestones(made.milestones, milestones);
        const { doc: goal } = await saveOnce(made, keyOf(req));

        res.status(201).json({ goal: await presentOne(req.user._id, goal) });
    } catch (error) {
        next(error);
    }
};

// @desc    Change a goal
// @route   PUT /api/goals/:id
export const updateGoal = async (req, res, next) => {
    try {
        const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id, ...KEPT });
        if (!goal) return res.status(404).json({ message: "Goal not found" });

        const { title, note, targetDate, milestones, links, reached } = req.body;

        if (links !== undefined) {
            // A link the goal already has stays even if its item has since been deleted
            const held = new Set(goal.links.map((link) => `${link.kind}:${link.item}`));
            const fresh = links.filter((link) => !held.has(`${link.kind}:${link.id}`));
            if (!(await ownLinks(req.user._id, fresh))) {
                return res.status(404).json({ message: "A linked routine or habit was not found." });
            }
            goal.links = links.map((link) => ({ kind: link.kind, item: link.id }));
        }
        if (title !== undefined) goal.title = title;
        if (note !== undefined) goal.note = note;
        if (targetDate !== undefined) goal.targetDate = targetDate;
        if (milestones !== undefined) goal.milestones = mergeMilestones(goal.milestones, milestones);
        if (reached !== undefined && reached !== Boolean(goal.reachedAt)) {
            goal.reachedAt = reached ? new Date() : null;
        }
        await goal.save();

        res.status(200).json({ goal: await presentOne(req.user._id, goal) });
    } catch (error) {
        next(error);
    }
};

// @desc    Tick a milestone, or un-tick it
// @route   PUT /api/goals/:id/milestones/:milestoneId
export const setMilestone = async (req, res, next) => {
    try {
        const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id, ...KEPT });
        const milestone = goal?.milestones.id(req.params.milestoneId);
        if (!milestone) return res.status(404).json({ message: "Milestone not found" });

        // Sent as the state wanted, so the same request arriving twice changes nothing
        if (milestone.done !== req.body.done) {
            milestone.done = req.body.done;
            milestone.doneAt = req.body.done ? new Date() : null;
            await goal.save();
        }

        res.status(200).json({ goal: await presentOne(req.user._id, goal) });
    } catch (error) {
        next(error);
    }
};

// @desc    Move a goal to Trash
// @route   DELETE /api/goals/:id
export const deleteGoal = async (req, res, next) => {
    try {
        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, ...KEPT },
            { $set: trashStamp(req.user) },
            { returnDocument: "after" },
        );
        if (!goal) return res.status(404).json({ message: "Goal not found" });

        res.status(200).json({
            message: "Goal moved to Trash",
            id: req.params.id,
            purgeAt: goal.purgeAt,
        });
    } catch (error) {
        next(error);
    }
};
