// Days that have ended, shaped for the screens that look back at them. Everything here is worked out
// from its arguments: what the API answers (services/historyService.js) goes in, what a screen draws comes out.

import { addDays, firstDayOf, lastDayOf, weekdayOf } from "./dates";
import { BLOCKS, blockAt, inDayOrder, tallyOf } from "./day";
import { parseTime, toMinutes } from "./time";
import { firstDayOfWeek, weekOrder } from "./week";

const BLOCK_IDS = new Set(BLOCKS.map((block) => block.id));

// The API has stored times both as "14:30" and as "2:30 PM"
const clock = (value) => (value ? parseTime(value) : null);

const share = (quantity, target) => Math.min(Math.max(quantity / target, 0), 1);

// One line of an ended day, in the shape buildDay gives the items of a day still running
const pastItem = (item) => {
    const routine = item.kind === "routine";
    const start = routine ? clock(item.startTime) : null;
    const done = item.status === "done" || item.status === "late";
    const counted = !routine && Boolean(item.counted);
    const target = counted ? item.target || 1 : 1;
    const quantity = routine ? undefined : (item.quantity ?? (done ? target : 0));

    return {
        key: `${item.kind}:${item.id}`,
        kind: item.kind,
        id: item.id,
        // null for something the account no longer holds; the screen has words for that
        title: item.title,
        // Still in the plan, so it has a page of its own to go to
        active: Boolean(item.active),
        block: routine
            ? blockAt(start === null ? 0 : toMinutes(start))
            : BLOCK_IDS.has(item.timeOfDay)
              ? item.timeOfDay
              : "anytime",
        start,
        end: routine ? clock(item.endTime) : null,
        order: 0,
        counted,
        quantity,
        target,
        unit: item.unit ?? "",
        // "done", "late", "partial" (a count that fell short) or "missed"
        status: item.status,
        done,
        late: item.status === "late",
        completedAt: clock(item.completedAt),
        progress: done ? 1 : counted ? share(quantity, target) : 0,
        // What it paid, and what leaving it cost
        xp: done ? (item.xpEarned ?? 0) : 0,
        lost: item.xpLost ?? 0,
    };
};

/**
 * An ended day, from what GET /history/days/:date answers, in the shape buildDay (lib/day.js) gives today,
 * so the same pieces draw it. Nothing in it can change: a part of the day is `sealed` simply by being complete.
 * @returns {Object} - recorded: false for a day nothing was due on and nothing was done on;
 *   blocks, items; total, done, left: counted the way the day itself was summed up when it closed;
 *   earned, bonus, lost: the XP its rows paid, the bonus for everything done, and what was taken;
 *   unnamed: how many things were left undone that the ledger could not name;
 *   perfect, run, streakEnded: whether everything due was done, and the run that made or ended
 */
export const buildPastDay = (detail) => {
    const all = (detail.items ?? []).map(pastItem);

    const blocks = BLOCKS.map(({ id, label }) => {
        const items = all.filter((item) => item.block === id).sort(inDayOrder);
        const done = items.filter((item) => item.done).length;
        const complete = items.length > 0 && done === items.length;

        return { id, label, items, total: items.length, done, complete, sealed: complete, current: false, nowIndex: null };
    }).filter((block) => block.total > 0);

    const items = blocks.flatMap((block) => block.items);
    const listed = { total: items.length, done: items.filter((item) => item.done).length };
    // The day's own summary knows what was due. Without one, what is listed is all there is.
    const tally = tallyOf(detail.summary);
    const { total, done } = tally && tally.total > 0 ? tally : listed;

    return {
        date: detail.date,
        recorded: Boolean(detail.summary) || items.length > 0,
        blocks,
        items,
        total,
        done,
        left: total - done,
        complete: total > 0 && done === total,
        open: items.filter((item) => !item.done),
        unnamed: detail.unnamed ?? 0,
        earned: items.reduce((sum, item) => sum + item.xp, 0),
        bonus: detail.bonus ?? 0,
        lost: detail.xpLost ?? 0,
        perfect: Boolean(detail.summary?.isPerfectDay),
        run: detail.run ?? 0,
        streakEnded: detail.streakEnded ?? 0,
    };
};

// What a set of ended days adds up to
export const sumDays = (days) => {
    const sum = { days: days.length, perfect: 0, total: 0, done: 0, lost: 0, net: 0 };

    for (const day of days) {
        const tally = tallyOf(day);
        sum.perfect += tally.perfect ? 1 : 0;
        sum.total += tally.total;
        sum.done += tally.done;
        sum.lost += day.xpLost ?? 0;
        sum.net += day.xpNet ?? 0;
    }

    return {
        ...sum,
        // What the days brought in before anything was taken off
        gained: sum.net + sum.lost,
        share: sum.total > 0 ? sum.done / sum.total : null,
    };
};

// The longest stretch of days in a row with everything done, among the days given.
// A day with nothing due is stepped over: it neither adds to a run nor ends one.
export const longestRunIn = (days) => {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const dates = [...byDate.keys()].sort();
    let longest = 0;
    let run = 0;
    let previous = null;

    for (const date of dates) {
        // A day with no record between two others ends whatever run there was
        if (previous && addDays(previous, 1) !== date) run = 0;
        previous = date;

        const day = byDate.get(date);
        if (day.isPerfectDay) {
            run += 1;
            if (run > longest) longest = run;
        } else if (!day.isRestDay) {
            run = 0;
        }
    }

    return longest;
};

/**
 * One month of days for the calendar, from what GET /history/days answers for it.
 * @param {Object} parts
 * @param {String} parts.month - "YYYY-MM"
 * @param {Array} parts.days - the month's day summaries
 * @param {String} parts.today - "YYYY-MM-DD"
 * @param {Object} [parts.live] - { total, done } as today stands right now, which no summary can know
 * @returns {Object} - marks: date => { total, done, perfect, lost, settled } for each day there is something
 *   to draw; stats: what the month's ended days add up to (see sumDays), with its longest run
 */
export const buildMonth = ({ month, days = [], today, live }) => {
    const first = firstDayOf(month);
    const last = lastDayOf(month);
    const marks = new Map();

    const ended = days.filter((day) => day.date >= first && day.date <= last && day.date < today);
    for (const day of ended) {
        marks.set(day.date, { ...tallyOf(day), lost: day.xpLost ?? 0, settled: true });
    }
    if (today >= first && today <= last && live) {
        marks.set(today, { total: live.total, done: live.done, perfect: false, lost: 0, settled: false });
    }

    return { month, marks, stats: { ...sumDays(ended), longestRun: longestRunIn(ended) } };
};

/**
 * How one routine or habit has gone on each day of the week, over the days on its record: what was
 * done (late included), and what was not. What was "due" is what was done and what was not, as on every
 * screen that looks back.
 * @param {Array} days - its days, as its history sends them: { date, status } ("done", "late", "partial", "missed")
 * @param {Number} [firstDay] - the day the reader's week starts on
 * @returns {Array} - in reading order, the days of the week it has a record on: { day, done, late, short, due }
 */
export const byWeekday = (days = [], firstDay = firstDayOfWeek()) => {
    const rows = new Map();

    for (const entry of days) {
        if (!["done", "late", "partial", "missed"].includes(entry.status)) continue;

        const day = weekdayOf(entry.date);
        const row = rows.get(day) ?? { day, done: 0, late: 0, short: 0, due: 0 };
        row.due += 1;
        if (entry.status === "done" || entry.status === "late") row.done += 1;
        if (entry.status === "late") row.late += 1;
        if (entry.status === "partial" || entry.status === "missed") row.short += 1;
        rows.set(day, row);
    }

    return weekOrder(firstDay).filter((day) => rows.has(day)).map((day) => rows.get(day));
};

