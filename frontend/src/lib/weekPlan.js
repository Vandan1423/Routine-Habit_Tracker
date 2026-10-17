// A week planned: its seven days, each with the to-dos planned for it and what the plan asks of it, the
// to-dos that have no day yet, how each routine and habit stood on each day, and how the week went.
// Like lib/plan.js it is worked out from its arguments alone.

import { addDays, weekdayOf, weekOf } from "./dates";
import { tallyOf } from "./day";
import { isDueOn, planItems } from "./plan";
import { byPlannedTime, leftOver, listLabel, unplanned } from "./todos";

// The first day of the week a day is in, as the reader's week starts
export const weekStartOf = (date, firstDay) => weekOf(date, firstDay)[0];

// The seven days of the week that starts on `start`
export const weekDates = (start) => Array.from({ length: 7 }, (_, index) => addDays(start, index));

// Whether a week is the one today is in, one gone by, or one still to come
export const weekWhen = (start, today) => {
    const end = addDays(start, 6);
    if (today < start) return "ahead";
    if (today > end) return "past";
    return "current";
};

// The planned to-dos of a week: the lists' own (which can be changed), and those read for a week further
// back than the lists carry. Each carries the name of its list.
const plannedIn = (lists, older, start, end) => {
    const labels = new Map(lists.map((list) => [list._id, listLabel(list)]));
    const found = new Map(older.map((todo) => [todo._id, { ...todo, listLabel: labels.get(todo.list) ?? "" }]));

    for (const list of lists) {
        for (const todo of list.todos) {
            if (todo.date && todo.date >= start && todo.date <= end) {
                found.set(todo._id, { ...todo, listLabel: listLabel(list) });
            }
        }
    }
    return [...found.values()];
};

/**
 * Builds the week.
 * @param {Object} input
 * @param {String} input.start - the week's first day, "YYYY-MM-DD"
 * @param {String} input.today - "YYYY-MM-DD"
 * @param {Array} input.lists - the to-do lists, as TodoContext holds them
 * @param {Array} [input.older] - planned to-dos read by range, for a week the lists no longer carry
 * @param {Array} input.routines - every routine in the plan; input.habits - every habit
 * @param {Array} [input.summaries] - the summaries of the week's days that have ended
 * @param {Object} input.live - { total, done } as today stands right now
 * @returns {Object} - when ("past", "current", "ahead"); days: for each day { date, day, when, todos (in the
 *   order the day is read), open, finished, standing: { total, done, missed } (what the plan asked that day
 *   and how it went; for a day still to come what it will ask), items (the routines and habits it asks for,
 *   by the plan as it is now) }; someday: what has no day yet; earlier: what was planned before this week
 *   and is still not done (only while it is this week); totals: { todos, todosDone, due, done, missed }
 */
export const buildWeek = ({ start, today, lists = [], older = [], routines = [], habits = [], summaries = [], live }) => {
    const dates = weekDates(start);
    const end = dates[6];
    const todos = plannedIn(lists, older, start, end);
    const items = planItems({ routines, habits });

    const days = dates.map((date) => {
        const when = date === today ? "today" : date < today ? "past" : "ahead";
        const planned = todos.filter((todo) => todo.date === date).sort(byPlannedTime);
        const due = items.filter((item) => isDueOn(item.kind, item.source, date));

        let standing;
        if (when === "today") standing = { total: live?.total ?? due.length, done: live?.done ?? 0, missed: 0 };
        else if (when === "ahead") standing = { total: due.length, done: 0, missed: 0 };
        else {
            const tally = tallyOf(summaries.find((summary) => summary.date === date));
            standing = { total: tally?.total ?? 0, done: tally?.done ?? 0, missed: (tally?.total ?? 0) - (tally?.done ?? 0) };
        }

        return {
            date,
            day: weekdayOf(date),
            when,
            todos: planned,
            open: planned.filter((todo) => !todo.done).length,
            finished: planned.filter((todo) => todo.done).length,
            standing,
            items: due,
        };
    });

    const sofar = days.filter((day) => day.when !== "ahead");
    const sum = (list, read) => list.reduce((total, day) => total + read(day), 0);

    return {
        start,
        end,
        when: weekWhen(start, today),
        days,
        someday: unplanned(lists),
        earlier: weekWhen(start, today) === "current" ? leftOver(lists, start) : [],
        totals: {
            todos: todos.length,
            todosDone: todos.filter((todo) => todo.done).length,
            due: sum(sofar, (day) => day.standing.total),
            done: sum(sofar, (day) => day.standing.done),
            missed: sum(sofar, (day) => day.standing.missed),
        },
    };
};

/**
 * The tracker: for each routine and habit, how it stood on each day of the week. A day that has ended
 * says what was recorded (done, done late, partly, or missed when it was charged for); one with nothing
 * on record that the plan asked for is "none", since a miss that cost nothing names nothing. Today says
 * what Today shows; a day still to come, whether it will ask for it ("ahead") or not ("off").
 * @param {Object} week - from buildWeek
 * @param {Object} found
 * @param {Map} found.marks - "date|kind|id" => { status, quantity }
 * @param {Map} found.live - key => today's item as Today draws it
 * @returns {Array} - rows: [{ item, cells: [{ date, status }], kept, asked }] routines by the clock, then habits;
 *   only what the plan asks of at least one day of the week
 */
export const trackerRows = (week, { marks, live }) => {
    // What the plan asks of the week's days. Something on record that the plan no longer holds has no name
    // here, and is not drawn.
    const seen = new Map();
    for (const day of week.days) for (const item of day.items) seen.set(item.key, item);

    const rows = [...seen.values()].map((item) => {
        const cells = week.days.map((day) => {
            const due = day.items.some((entry) => entry.key === item.key);

            if (day.when === "ahead") return { date: day.date, status: due ? "ahead" : "off" };
            if (day.when === "today") {
                const now = live.get(item.key);
                if (!now) return { date: day.date, status: due ? "open" : "off" };
                if (now.done) return { date: day.date, status: now.late ? "late" : "done" };
                return { date: day.date, status: item.kind === "habit" && now.progress > 0 ? "partial" : "open" };
            }

            const mark = marks.get(`${day.date}|${item.kind}|${item.id}`);
            if (mark) return { date: day.date, status: mark.status };
            return { date: day.date, status: due ? "none" : "off" };
        });

        return {
            item,
            cells,
            kept: cells.filter((cell) => cell.status === "done" || cell.status === "late").length,
            asked: cells.filter((cell) => !["off", "ahead"].includes(cell.status)).length,
        };
    });

    const order = (row) => (row.item.kind === "routine" ? 0 : 1);
    return rows.sort(
        (a, b) =>
            order(a) - order(b) ||
            (a.item.start ?? "").localeCompare(b.item.start ?? "") ||
            (a.item.order ?? 0) - (b.item.order ?? 0),
    );
};

/**
 * Where "Move what is left to next week" puts each unfinished to-do: the same day of the next week,
 * or today if that has already gone by (a week far back)
 */
export const nextWeekDay = (date, today) => {
    const next = addDays(date, 7);
    return next < today ? today : next;
};

// What of a week is still not done and could be moved on: every open to-do of a day before today,
// and, once the week's last day has come, that day's too
export const unfinishedIn = (week, today) =>
    week.days
        .filter((day) => day.date < today || (day.date === today && day.date === week.end))
        .flatMap((day) => day.todos.filter((todo) => !todo.done));
