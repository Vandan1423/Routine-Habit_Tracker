// The day model: what the API knows as two lists (routines with a clock time, habits without one)
// becomes one day, in the order it is lived. Everything here is worked out from its arguments,
// so the same lists and the same clock always give the same day.

import { LATE_GRACE_MINUTES, lateWorth } from "./stakes";
import { isDraftId, rowKeyOf } from "./drafts";
import { parseTime, toMinutes } from "./time";

// The parts of a day, in order. A routine falls into one by its start time; a habit is given one
// (its timeOfDay), and "anytime" is where a habit sits until it has been.
export const BLOCKS = [
    { id: "morning", label: "Morning" },
    { id: "afternoon", label: "Afternoon" },
    { id: "evening", label: "Evening" },
    { id: "anytime", label: "Anytime" },
];

const BLOCK_IDS = new Set(BLOCKS.map((block) => block.id));

// Where the day is cut: the afternoon starts at noon, the evening at five
const AFTERNOON_STARTS = 12 * 60;
const EVENING_STARTS = 17 * 60;

export const blockAt = (minutes) => {
    if (minutes < AFTERNOON_STARTS) return "morning";
    if (minutes < EVENING_STARTS) return "afternoon";
    return "evening";
};

// The server counts a routine as late once it is done more than a quarter of an hour after its end time,
// and pays half for it (see lib/stakes.js). With no end time there is nothing to be late for.
export { lateWorth };

// A routine with no end time is taken to be under way for this long after it starts
const OPEN_ENDED_MINUTES = 30;
// "In 25 min" is said of something this close; further off, it is simply next
const SOON_MINUTES = 60;

// The API has stored times both as "14:30" and as "2:30 PM"
const clock = (value) => (value ? parseTime(value) : null);

export const minutesOf = (date) => date.getHours() * 60 + date.getMinutes();

// Whether a routine's deadline has gone by. One with no end time has none.
const pastDeadline = (routine, nowMinutes) => {
    const end = clock(routine.endTime);
    return end !== null && nowMinutes > toMinutes(end) + LATE_GRACE_MINUTES;
};

/**
 * The log a routine is shown with from the moment it is ticked until the server answers with the real one:
 * the same lateness and XP the server will work out, as near as this device's clock can tell.
 */
export const expectedRoutineLog = (routine, now = new Date()) => {
    const late = pastDeadline(routine, minutesOf(now));
    const worth = routine.xpReward ?? 0;

    return { wasOnTime: !late, xpEarned: late ? lateWorth(worth) : worth };
};

const routineItem = (routine, nowMinutes) => {
    const start = clock(routine.startTime);
    const end = clock(routine.endTime);
    const log = routine.todayLog ?? null;
    const done = Boolean(log);
    const worth = routine.xpReward ?? 0;
    const overdue = pastDeadline(routine, nowMinutes);
    // Done: what the server recorded. Still open: what it would record if it were done now.
    const late = done ? log.wasOnTime === false : overdue;

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
        end,
        order: routine.order ?? 0,
        counted: false,
        done,
        late,
        // Its deadline has gone by, whether or not it was done in time: done again now, it would count as late
        overdue,
        progress: done ? 1 : 0,
        worth,
        // What it has paid, or what it would pay now
        xp: done ? (log.xpEarned ?? worth) : late ? lateWorth(worth) : worth,
    };
};

const habitItem = (habit) => {
    const counted = habit.habitType === "quantity";
    const target = counted ? habit.targetQuantity || 1 : 1;
    const log = habit.todayLog ?? null;
    const done = Boolean(log?.completed);
    const quantity = counted ? (log?.quantity ?? 0) : done ? 1 : 0;

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
        order: habit.order ?? 0,
        counted,
        quantity,
        target,
        unit: habit.unit ?? "",
        done,
        late: false,
        overdue: false,
        progress: done ? 1 : Math.min(Math.max(quantity / target, 0), 1),
        worth: habit.xpReward ?? 0,
        xp: done ? (log.xpEarned ?? habit.xpReward ?? 0) : (habit.xpReward ?? 0),
    };
};

// A habit kept on some weekdays only is listed on the others too (dueToday false). It belongs to today
// if today is one of its days, or if something was logged for it today anyway.
// An older server sends no dueToday at all; then every habit counts, as it always did.
const belongsToday = (habit) => habit.dueToday !== false || Boolean(habit.todayLog);

// Routines by the clock, then habits in the order they have been put in on Plan
// (habits never moved share an order, and stay as the list has them: in the order they were made)
export const inDayOrder = (a, b) => {
    if (a.start !== null && b.start !== null) {
        return toMinutes(a.start) - toMinutes(b.start) || a.order - b.order;
    }
    if (a.start !== null) return -1;
    if (b.start !== null) return 1;
    return a.order - b.order;
};

/**
 * Where the "now" line is drawn inside the block the clock is in: before the item at this index.
 * It sits between the routines that have started and those still ahead. null when the block has no routines.
 */
const nowIndexIn = (items, nowMinutes) => {
    const timed = items.filter((item) => item.start !== null);
    if (timed.length === 0) return null;

    const ahead = items.findIndex(
        (item) => item.start !== null && toMinutes(item.start) > nowMinutes,
    );
    return ahead === -1 ? timed.length : ahead;
};

/**
 * The one item to turn to. In order of preference: a routine that is under way; a routine about to start;
 * the first open item of the part of the day the clock is in; the next routine later on; anything still open.
 * @returns {Object|null} - { item, state }, where state is "now", "soon" (with `inMinutes`) or "next"
 */
const findNext = (items, nowMinutes, currentBlock) => {
    const open = items.filter((item) => !item.done);
    if (open.length === 0) return null;

    const timed = open.filter((item) => item.start !== null);

    const underWay = timed.find((item) => {
        const start = toMinutes(item.start);
        const end = item.end !== null ? toMinutes(item.end) : start + OPEN_ENDED_MINUTES;
        return start <= nowMinutes && nowMinutes < end;
    });
    if (underWay) return { item: underWay, state: "now" };

    const upcoming = timed
        .filter((item) => toMinutes(item.start) > nowMinutes)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
    if (upcoming && toMinutes(upcoming.start) - nowMinutes <= SOON_MINUTES) {
        return {
            item: upcoming,
            state: "soon",
            inMinutes: toMinutes(upcoming.start) - nowMinutes,
        };
    }

    const inThisBlock = open.find((item) => item.block === currentBlock);
    const item = inThisBlock ?? upcoming ?? open[0];
    return { item, state: "next" };
};

/**
 * Builds today.
 * @param {Object} lists
 * @param {Array} lists.routines - today's routines as GET /routines returns them (each with its todayLog)
 * @param {Array} lists.habits - every habit as GET /habits returns it (todayLog, dueToday, timeOfDay)
 * @param {Date} lists.now - the moment to build it for
 * @param {Set} [lists.pending] - the keys of items whose latest change the server has not confirmed yet
 * @returns {Object} - blocks: the parts of the day that have something in them, each with its items in order,
 *   how many are done, whether it is the part the clock is in, and where the "now" line goes;
 *   items: every item in day order; total, done, left; earned: the XP today's completions have paid;
 *   next: the one to turn to (see findNext).
 *   A block, and the day, is `complete` once everything in it is ticked, and `sealed` once the server
 *   has also accepted every one of those ticks. Anything that marks the occasion waits for sealed.
 */
export const buildDay = ({ routines = [], habits = [], now = new Date(), pending }) => {
    const nowMinutes = minutesOf(now);
    const currentBlock = blockAt(nowMinutes);
    const waiting = (item) => Boolean(pending?.has(item.key));

    const all = [
        ...routines.map((routine) => routineItem(routine, nowMinutes)),
        ...habits.filter(belongsToday).map(habitItem),
    ];

    const blocks = BLOCKS.map(({ id, label }) => {
        const items = all.filter((item) => item.block === id).sort(inDayOrder);
        const done = items.filter((item) => item.done).length;
        const current = id === currentBlock;
        const complete = items.length > 0 && done === items.length;

        return {
            id,
            label,
            items,
            total: items.length,
            done,
            complete,
            sealed: complete && !items.some(waiting),
            current,
            nowIndex: current ? nowIndexIn(items, nowMinutes) : null,
        };
    }).filter((block) => block.total > 0);

    const items = blocks.flatMap((block) => block.items);
    const done = items.filter((item) => item.done);
    const complete = items.length > 0 && done.length === items.length;

    return {
        blocks,
        items,
        total: items.length,
        done: done.length,
        left: items.length - done.length,
        complete,
        sealed: complete && !items.some(waiting),
        earned: done.reduce((sum, item) => sum + item.xp, 0),
        next: findNext(items, nowMinutes, currentBlock),
        currentBlock,
    };
};

/**
 * A day that is over, as the API summarises it (one of /streaks/info's recentLogs), counted the way a day is shown:
 * routines and habits together.
 * @returns {Object|null} - { total, done, perfect, rest }; perfect is the server's word for "everything due was
 *   done", rest for "nothing was due"
 */
export const tallyOf = (summary) => {
    if (!summary) return null;

    const total = (summary.totalRoutines ?? 0) + (summary.totalHabits ?? 0);
    const done = (summary.completedRoutines ?? 0) + (summary.completedHabits ?? 0);

    return {
        total,
        done: Math.min(done, total),
        perfect: Boolean(summary.isPerfectDay),
        rest: Boolean(summary.isRestDay),
    };
};

// The first thing with a time on a list of routines: what a day starts with
export const firstRoutineOf = (routines = []) =>
    routines
        .map((routine) => ({ title: routine.title, start: clock(routine.startTime) }))
        .filter((routine) => routine.start !== null)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0] ?? null;

/**
 * How much one press of a counted habit's stepper adds or takes away: 1 for small targets
 * (8 glasses), and a round share of the target for large ones (5 of 20 pages, 1,000 of 10,000 steps).
 */
export const stepFor = (target) => {
    if (target <= 12 && Number.isInteger(target)) return 1;

    const rough = target / 8;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const round = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= rough) * magnitude;

    // Powers of ten below one are not exact in binary (0.1 * 5 is fine, 0.01 * 2 is not quite)
    return Number(round.toPrecision(6));
};

// A stepped count stays between nothing and the target, and free of binary crumbs (0.1 + 0.2)
export const stepQuantity = (quantity, target, direction) => {
    const next = quantity + direction * stepFor(target);
    return Number(Math.min(Math.max(next, 0), target).toPrecision(9));
};
