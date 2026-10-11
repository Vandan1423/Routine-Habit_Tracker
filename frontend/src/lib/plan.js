// The plan: everything the account has set itself to do, whatever day it falls on, laid out the way
// a day is (Morning, Afternoon, Evening, Anytime). Like lib/day.js it is worked out from its arguments
// alone: the same lists give the same plan.

import { BLOCKS, blockAt } from "./day";
import { isDraftId, rowKeyOf } from "./drafts";
import { localDay, weekdayOf, weekOf } from "./dates";
import { isPausedOn, pauseAhead } from "./pauses";
import { parseTime, toMinutes } from "./time";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const BLOCK_IDS = new Set(BLOCKS.map((block) => block.id));

// The API has stored times both as "14:30" and as "2:30 PM"
const clock = (value) => (value ? parseTime(value) : null);

/**
 * The days of the week an item falls on, 0 for Sunday to 6 for Saturday.
 * A one-off task falls on none of them: it has a date instead. A habit with no days chosen is kept every day.
 */
export const daysOf = (kind, item) => {
    if (kind === "routine") return item.isRecurring ? [...(item.recurringDays ?? [])].sort() : [];

    const chosen = item.frequency === "weekly" ? (item.targetDays ?? []) : [];
    return chosen.length > 0 ? [...chosen].sort() : EVERY_DAY;
};

// Whether an item is meant to be done on a day ("YYYY-MM-DD"), by the same rules the server applies.
// A day it is paused on asks nothing of it.
export const isDueOn = (kind, item, date) => {
    if (isPausedOn(item, date)) return false;
    if (kind === "routine" && !item.isRecurring) return item.date === date;
    return daysOf(kind, item).includes(weekdayOf(date));
};

const routineItem = (routine) => {
    const start = clock(routine.startTime);

    return {
        key: `routine:${routine._id}`,
        // What its row is told apart by, and whether it is still on its way to the server (see lib/drafts.js):
        // until the server has it, nothing on its row can be pressed
        row: `routine:${rowKeyOf(routine._id)}`,
        saving: isDraftId(routine._id),
        kind: "routine",
        id: routine._id,
        title: routine.title,
        block: blockAt(start === null ? 0 : toMinutes(start)),
        start,
        end: clock(routine.endTime),
        days: daysOf("routine", routine),
        // A one-off task: the one day it is for
        once: routine.isRecurring ? null : (routine.date ?? null),
        order: routine.order ?? 0,
        counted: false,
        worth: routine.xpReward ?? 0,
        source: routine,
    };
};

const habitItem = (habit) => {
    const counted = habit.habitType === "quantity";

    return {
        key: `habit:${habit._id}`,
        // What its row is told apart by, and whether it is still on its way to the server (see lib/drafts.js):
        // until the server has it, nothing on its row can be pressed
        row: `habit:${rowKeyOf(habit._id)}`,
        saving: isDraftId(habit._id),
        kind: "habit",
        id: habit._id,
        title: habit.title,
        block: BLOCK_IDS.has(habit.timeOfDay) ? habit.timeOfDay : "anytime",
        start: null,
        end: null,
        days: daysOf("habit", habit),
        once: null,
        order: habit.order ?? 0,
        counted,
        target: counted ? habit.targetQuantity || 1 : 1,
        unit: habit.unit ?? "",
        worth: habit.xpReward ?? 0,
        source: habit,
    };
};

// Routines by the clock, then habits in the order they have been put in
const inPlanOrder = (a, b) => {
    if (a.start !== null && b.start !== null) {
        return toMinutes(a.start) - toMinutes(b.start) || a.order - b.order;
    }
    if (a.start !== null) return -1;
    if (b.start !== null) return 1;
    return a.order - b.order;
};

const byDateThenTime = (a, b) =>
    a.once.localeCompare(b.once) ||
    (a.start === null ? 0 : toMinutes(a.start)) - (b.start === null ? 0 : toMinutes(b.start));

/**
 * Builds the plan.
 * @param {Object} lists
 * @param {Array} lists.routines - every routine, as GET /routines/all returns them
 * @param {Array} lists.habits - every habit, as GET /habits returns them
 * @param {String} [lists.today] - "YYYY-MM-DD"; this device's own day when left out
 * @param {String|null} [lists.day] - show one day of this week only ("YYYY-MM-DD"); null for the whole plan
 * @param {Number} [lists.firstDay] - the day the reader's week starts on
 * @returns {Object} - blocks: the parts of the day, each with the repeating items that sit in it, in order,
 *   and `habits`: how many of them are habits (the ones that can be put in another order). Each item carries
 *   `pause`: the pause that covers today or is still to come ({ from, until }), or null;
 *   upcoming: the one-off tasks still to come, soonest first (with one day shown, the ones dated that day);
 *   week: for each day of the week today is in, in reading order, { date, day, total, worth, once }:
 *   how much that day asks, one-off tasks included, and how many of those there are;
 *   total: how many repeating items there are; empty: nothing repeats and nothing is still to come.
 */
export const buildPlan = ({ routines = [], habits = [], today = localDay(), day = null, firstDay } = {}) => {
    const all = [...routines.map(routineItem), ...habits.map(habitItem)].map((item) => ({
        ...item,
        pause: pauseAhead(item.source, today),
    }));
    const repeating = all.filter((item) => item.once === null);
    // A one-off task belongs to one date. The ones of this week that have passed are still held,
    // so that a day of the week already gone shows what it asked for.
    const once = all.filter((item) => item.once !== null);
    const ahead = once.filter((item) => item.once >= today);

    // What a day asks: a paused item asks nothing of the days it is off
    const dueOn = (date) =>
        repeating.filter((item) => item.days.includes(weekdayOf(date)) && !isPausedOn(item.source, date));
    const shown = day === null ? repeating : dueOn(day);

    const blocks = BLOCKS.map(({ id, label }) => {
        const items = shown.filter((item) => item.block === id).sort(inPlanOrder);

        return {
            id,
            label,
            items,
            habits: items.filter((item) => item.kind === "habit").length,
        };
    }).filter((block) => block.items.length > 0);

    return {
        blocks,
        upcoming: (day === null ? ahead : once.filter((item) => item.once === day)).sort(byDateThenTime),
        week: weekOf(today, firstDay).map((date) => {
            const tasks = once.filter((item) => item.once === date && !isPausedOn(item.source, date));
            const due = [...dueOn(date), ...tasks];

            return {
                date,
                day: weekdayOf(date),
                total: due.length,
                worth: due.reduce((sum, item) => sum + item.worth, 0),
                once: tasks.length,
            };
        }),
        total: repeating.length,
        empty: repeating.length === 0 && ahead.length === 0,
    };
};

// One item of the plan by its key ("habit:…"), or null
export const findPlanItem = ({ routines = [], habits = [] }, kind, id) => {
    const source = (kind === "routine" ? routines : habits).find((item) => item._id === id);
    if (!source) return null;

    return kind === "routine" ? routineItem(source) : habitItem(source);
};

/**
 * A block's habits in a new order: the habit at `from` among them moved to `to`.
 * @returns {Array} - the habits' ids in their new order
 */
export const moveWithin = (ids, from, to) => {
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    return next;
};
