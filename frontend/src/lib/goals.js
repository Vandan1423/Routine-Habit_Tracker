// Goals, laid out for the screen, and the form one is set in. Worked out from its arguments alone.

import { isDraftId } from "./drafts";

const DAY_MS = 24 * 60 * 60 * 1000;

// How far back "how it has been kept" looks, today included
export const KEPT_DAYS = 30;

export const MOST_MILESTONES = 30;
export const MOST_LINKS = 20;

const toUtc = (day) => Date.parse(`${day}T00:00:00Z`);

// Whole days from one day to another: 3 from the 1st to the 4th, -1 from today to yesterday
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

const linkKey = (link) => `${link.kind}:${link.id}`;

/**
 * One goal as it is shown.
 * @param {Object} goal - as GET /goals returns it
 * @param {Object} context
 * @param {String} context.today - "YYYY-MM-DD"
 * @param {Map} [context.tallies] - "kind:id" => { done, missed } over the last KEPT_DAYS days (see talliesOf)
 * @returns {Object} - the goal's own fields, and: reached; steps: { total, done }; allDone: it has milestones
 *   and every one is ticked; daysLeft: whole days until its date (negative once past), or null without one;
 *   links: each with `kept` ({ done, due }) or null when nothing is on record for it
 */
export const layoutGoal = (goal, { today, tallies = new Map() }) => {
    const total = goal.milestones.length;
    const done = goal.milestones.filter((milestone) => milestone.done).length;

    return {
        ...goal,
        id: goal._id,
        reached: Boolean(goal.reachedAt),
        steps: { total, done },
        allDone: total > 0 && done === total,
        daysLeft: goal.targetDate && today ? daysBetween(today, goal.targetDate) : null,
        links: goal.links.map((link) => {
            const tally = tallies.get(linkKey(link));
            const due = tally ? tally.done + tally.missed : 0;

            return { ...link, kept: due > 0 ? { done: tally.done, due } : null };
        }),
    };
};

/**
 * Every goal, laid out and told apart: the ones still open, then the ones reached.
 * @param {Array} goals - as GET /goals returns them, already in the order they are shown
 */
export const layoutGoals = (goals = [], context) => {
    const all = goals.map((goal) => layoutGoal(goal, context));

    return {
        open: all.filter((goal) => !goal.reached),
        reached: all.filter((goal) => goal.reached),
        total: all.length,
    };
};

// How each routine and habit went, from what GET /history/items answers: "kind:id" => { done, missed }
export const talliesOf = (items = []) =>
    new Map(items.map((item) => [`${item.kind}:${item.id}`, { done: item.done, missed: item.missed }]));

// ── Changes shown before the server has answered ──

export const withMilestone = (goal, milestoneId, done) => ({
    ...goal,
    milestones: goal.milestones.map((milestone) =>
        milestone.id === milestoneId
            ? { ...milestone, done, doneAt: done ? new Date().toISOString() : null }
            : milestone,
    ),
});

export const withGoal = (goals, goal) =>
    goals.some((entry) => entry._id === goal._id)
        ? goals.map((entry) => (entry._id === goal._id ? goal : entry))
        : [...goals, goal];

// The order the server lists goals in: the open ones first, the soonest date first, then as they were made
const inGoalOrder = (a, b) =>
    Number(Boolean(a.reachedAt)) - Number(Boolean(b.reachedAt)) ||
    (a.targetDate ?? "9999-99-99").localeCompare(b.targetDate ?? "9999-99-99") ||
    String(a.createdAt).localeCompare(String(b.createdAt));

/**
 * The goals with one put among them where the server will list it, in place of the goal with its id or
 * with the id `instead` (the saved one taking over from what was shown for it).
 */
export const withGoalPlaced = (goals, goal, instead = goal._id) =>
    [...goals.filter((entry) => entry._id !== goal._id && entry._id !== instead), goal].sort(inGoalOrder);

/**
 * A goal as the API would send it, made from what its form sends: what is shown while the real one is
 * on its way. It is marked `pending`, and nothing on it can be pressed until the server has it.
 * @param {Object} payload - from goalPayload
 * @param {Object} from - id: what a new one goes by meanwhile; existing: the goal it rewrites, if any;
 *   items: the routines and habits there are, for the names of the ones that carry it
 */
export const draftGoal = (payload, { id, existing = null, items = [], now = new Date() }) => {
    const was = new Map((existing?.milestones ?? []).map((milestone) => [milestone.id, milestone]));

    return {
        ...existing,
        _id: existing?._id ?? id,
        pending: true,
        title: payload.title,
        note: payload.note,
        targetDate: payload.targetDate,
        reachedAt: existing?.reachedAt ?? null,
        createdAt: existing?.createdAt ?? now.toISOString(),
        milestones: payload.milestones.map((milestone, index) => ({
            id: milestone.id ?? `${id}:${index}`,
            title: milestone.title,
            done: Boolean(milestone.done),
            doneAt: milestone.done ? (was.get(milestone.id)?.doneAt ?? now.toISOString()) : null,
        })),
        links: payload.links
            .map((link) => {
                const item = items.find((entry) => entry._id === link.id);
                return item ? { kind: link.kind, id: link.id, title: item.title, active: true } : null;
            })
            .filter(Boolean),
    };
};

// ── The form ──

let rowCount = 0;
// A milestone's row in the form needs a name of its own before the server has given it one
const rowKey = () => `row-${++rowCount}`;

export const emptyGoal = () => ({ title: "", note: "", targetDate: "", milestones: [], links: [] });

export const goalFormOf = (goal) => ({
    title: goal.title ?? "",
    note: goal.note ?? "",
    targetDate: goal.targetDate ?? "",
    milestones: goal.milestones.map((milestone) => ({
        key: milestone.id,
        id: milestone.id,
        title: milestone.title,
        done: milestone.done,
    })),
    links: goal.links.map(linkKey),
});

export const newMilestoneRow = () => ({ key: rowKey(), id: null, title: "", done: false });

// What is wrong with the form, by field. Empty when it can be sent.
export const validateGoal = (form) => {
    const errors = {};
    const title = form.title.trim();

    if (!title) errors.title = "Say what you want to reach.";
    else if (title.length > 120) errors.title = "Keep it under 120 characters.";
    if (form.note.trim().length > 500) errors.note = "Keep the note under 500 characters.";

    return errors;
};

/**
 * The form as the API takes it. A milestone left blank is dropped; one the goal already had keeps its id,
 * so what was ticked stays ticked.
 */
export const goalPayload = (form) => ({
    title: form.title.trim(),
    note: form.note.trim(),
    targetDate: form.targetDate || null,
    milestones: form.milestones
        .filter((milestone) => milestone.title.trim())
        .map((milestone) => ({
            ...(milestone.id ? { id: milestone.id } : {}),
            title: milestone.title.trim(),
            done: milestone.done,
        })),
    links: form.links.map((key) => {
        const [kind, id] = key.split(":");
        return { kind, id };
    }),
});

/**
 * What a goal can be carried by: every repeating routine and every habit in the plan, plus anything
 * the goal is already linked to that has since left it (so saving the form does not drop the link unasked).
 * @param {Array} routines - from usePlan()
 * @param {Array} habits - from useToday()
 * @param {Object} [goal] - the goal being changed
 * @returns {Array} - [{ key, kind, title, gone }]
 */
export const linkChoices = (routines = [], habits = [], goal = null) => {
    const choices = [
        ...routines
            // One still on its way to the server has no id to be linked by yet
            .filter((routine) => routine.isRecurring && !isDraftId(routine._id))
            .map((routine) => ({ key: `routine:${routine._id}`, kind: "routine", title: routine.title, gone: false })),
        ...habits
            .filter((habit) => !isDraftId(habit._id))
            .map((habit) => ({ key: `habit:${habit._id}`, kind: "habit", title: habit.title, gone: false })),
    ];
    const known = new Set(choices.map((choice) => choice.key));

    for (const link of goal?.links ?? []) {
        if (!known.has(linkKey(link))) {
            choices.push({ key: linkKey(link), kind: link.kind, title: link.title, gone: true });
        }
    }

    return choices;
};
