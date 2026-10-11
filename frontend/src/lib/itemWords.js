// The words said about one routine or habit: when it falls, what is at stake, how it has gone.
// Kept in one place, like the day's words in lib/dayMessage.js, so that screens do not write their own.

import { addDays, formatDayBrief, weekdayOf } from "./dates";
import { countWord } from "./dayMessage";
import { LATE_GRACE_MINUTES, lateWorth, missCost } from "./stakes";
import { formatTimeRange } from "./time";
import { weekdayName, weekOrder } from "./week";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();
const amountFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;
const times = (count) =>
    count === 1 ? "once" : count === 2 ? "twice" : `${countWord(count).toLowerCase()} times`;
const sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const sameDays = (days, wanted) =>
    days.length === wanted.length && wanted.every((day) => days.includes(day));

/**
 * The days of the week in words: "Every day", "Weekdays", "Weekends", "Mondays", "Mon, Wed, Fri".
 * @param {Array} days - 0 for Sunday to 6 for Saturday
 * @param {Number} [firstDay] - the day the reader's week starts on, for the order they are listed in
 */
export const daysWords = (days, firstDay) => {
    if (days.length === 7) return "Every day";
    if (sameDays(days, [1, 2, 3, 4, 5])) return "Weekdays";
    if (sameDays(days, [0, 6])) return "Weekends";
    if (days.length === 1) return `${weekdayName(days[0])}s`;
    if (days.length === 6) {
        return `Every day but ${weekdayName([0, 1, 2, 3, 4, 5, 6].find((day) => !days.includes(day)))}`;
    }

    return weekOrder(firstDay)
        .filter((day) => days.includes(day))
        .map((day) => weekdayName(day, "short"))
        .join(", ");
};

// The one day a one-off task is for, said from where today stands: "Today", "Tomorrow", "Tue 14 Oct"
export const onceWords = (date, today) => {
    if (date === today) return "Today";
    if (today && date === addDays(today, 1)) return "Tomorrow";
    return formatDayBrief(date);
};

/**
 * When an item of the plan falls.
 * @param {Object} item - from buildPlan (lib/plan.js)
 * @param {Object} [options] - today: "YYYY-MM-DD"; firstDay: the day the reader's week starts on
 */
export const patternWords = (item, { today, firstDay } = {}) =>
    item.once ? onceWords(item.once, today) : daysWords(item.days, firstDay);

// What sits beside an item's name: a routine's hours, or what a counted habit asks for ("20 pages")
export const detailWords = (item) => {
    if (item.kind === "routine") return formatTimeRange(item.start, item.end);
    if (!item.counted) return "";

    return `${amountFormat.format(item.target)}${item.unit ? `${NBSP}${item.unit}` : ""}`;
};

/**
 * What an item is worth and what leaving it costs, stated plainly.
 * @param {String} kind - "routine" or "habit"
 * @param {Object} facts - worth: its XP; hasEnd: a routine with an end time; once: a one-off task
 */
export const stakesWords = (kind, { worth, hasEnd = false, once = false }) => {
    const cost = missCost(kind, worth);
    const left = `Left undone, it costs ${xp(cost)} when the day closes.`;

    if (kind === "habit") {
        return `Worth ${xp(worth)} each day it is due. ${left}`;
    }

    const when = once ? "that day" : "on its day";
    return hasEnd
        ? `Worth ${xp(worth)}, or ${xp(lateWorth(worth))} if it is done more than ${LATE_GRACE_MINUTES}${NBSP}minutes after it ends. ${left}`
        : `Worth ${xp(worth)} whenever it is done ${when}. ${left}`;
};

/**
 * How an item has gone, as one or two sentences.
 * @param {Object} history - what GET /…/history answers: totals and run
 * @param {Object} [options] - once: a one-off task, which has no run to speak of
 * @returns {Object} - { lead, rest }: the first sentence, and anything that follows it
 */
export const historyWords = ({ totals, run }, { once = false } = {}) => {
    if (totals.done === 0 && totals.missed === 0) {
        return { lead: "Nothing on record yet.", rest: "Its first day will show here." };
    }

    const parts = [];

    if (!once && run.current > 1) {
        parts.push(
            run.current >= run.best
                ? `On a run of ${numberFormat.format(run.current)}, its longest yet.`
                : `On a run of ${numberFormat.format(run.current)}; the longest was ${numberFormat.format(run.best)}.`,
        );
    } else if (!once && run.best > 1) {
        parts.push(`The longest run was ${numberFormat.format(run.best)}.`);
    }

    if (totals.late > 0) {
        parts.push(`${sentence(times(totals.late))} it was late.`);
    }
    if (totals.missed > 0) {
        parts.push(
            totals.xpLost > 0
                ? `Missed ${times(totals.missed)}, which cost ${xp(totals.xpLost)}.`
                : `Missed ${times(totals.missed)}.`,
        );
    }

    return {
        lead: totals.done === 0 ? "Not done yet." : `Done ${times(totals.done)}.`,
        rest: parts.join(" "),
    };
};

// What a day on an item's calendar says when it is read out or pointed at
export const dayStatusWords = (day, { unit = "" } = {}) => {
    if (!day) return "";
    if (day.status === "done") return "Done";
    if (day.status === "late") return "Done late";
    if (day.status === "missed") return day.xpLost ? `Missed, ${xp(day.xpLost)} lost` : "Missed";

    return `${amountFormat.format(day.quantity ?? 0)}${unit ? `${NBSP}${unit}` : ""}, short of the target`;
};

const counted = (count, one, many) =>
    `${countWord(count).toLowerCase()} ${count === 1 ? one : many}`;
const listed = (parts) =>
    parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

/**
 * The line at the head of Plan: how much has been taken on, or what one day of this week asks.
 * @param {Object} plan - from buildPlan (lib/plan.js), built for the whole plan
 * @param {String|null} day - the one day being shown ("YYYY-MM-DD"), or null
 * @param {String} [today]
 */
export const planWords = (plan, day = null, today = null) => {
    if (plan.empty) return "Nothing is planned yet.";

    if (day !== null) {
        const entry = plan.week.find((candidate) => candidate.date === day);
        const name = day === today ? "Today" : weekdayName(weekdayOf(day));

        if (!entry?.total) return `Nothing falls on ${day === today ? "today" : name}.`;

        // What comes round every week, then what is there only this once
        const repeating = entry.total - entry.once;
        const tasks = entry.once > 0 && counted(entry.once, "one-off task", "one-off tasks");
        const parts = [repeating > 0 && counted(repeating, "thing", "things"), tasks].filter(Boolean);

        return `${name}: ${listed(parts)}, worth ${xp(entry.worth)}.`;
    }

    const all = plan.blocks.flatMap((block) => block.items);
    const routines = all.filter((item) => item.kind === "routine").length;
    const habits = all.length - routines;
    const parts = [
        routines > 0 && counted(routines, "routine", "routines"),
        habits > 0 && counted(habits, "habit", "habits"),
        plan.upcoming.length > 0 && counted(plan.upcoming.length, "one-off task", "one-off tasks"),
    ].filter(Boolean);

    return `${sentence(listed(parts))}.`;
};

// Said to a screen reader when a habit is moved up or down its part of the day
export const movedWords = (title, position, total) =>
    `${title} moved to place ${position} of ${total}.`;

export const KIND_WORDS = {
    routine: { name: "routine", title: "Routine" },
    habit: { name: "habit", title: "Habit" },
};

// What the toast says once something has been deleted, and when a save or a delete fails
export const deletedWords = (title) => `“${title}” moved to Trash`;

/**
 * What the toast adds once a routine or habit is in Trash: the XP an older delete took (none now), and whether tonight
 * still counts it as missed.
 * @param {Object} answer - what the delete answered: { xpTaken, owed }
 */
export const trashedDetail = ({ xpTaken = 0, owed = 0 } = {}) => {
    const parts = [
        xpTaken > 0 && `The ${xp(xpTaken)} it earned went with it.`,
        owed > 0 && `It was still due today: tonight counts it as missed, ${xp(owed)}.`,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" ") : undefined;
};
export const notDeletedWords = (title) => `“${title}” wasn’t deleted.`;

// ── Retiring to Archive, and bringing back ──

export const retiredWords = (title) => `“${title}” retired to Archive`;

// What the toast adds once it is retired: whether tonight still counts it as missed
export const retiredDetail = ({ owed = 0 } = {}) =>
    owed > 0
        ? `It was still due today: tonight counts it as missed, ${xp(owed)}, unless it is brought back and done.`
        : "Its history is kept there. Bring it back whenever you want it again.";

export const broughtBackWords = (title) => `“${title}” is back in the plan`;
export const notRetiredWords = (title) => `“${title}” wasn’t retired.`;
export const notBroughtBackWords = (title) => `“${title}” didn’t come back.`;

// ── Pausing ──

// A day named inside a sentence: "today", "tomorrow", "Sat 18 Oct"
const dayRef = (date, today) => {
    if (date === today) return "today";
    if (today && date === addDays(today, 1)) return "tomorrow";
    return formatDayBrief(date);
};

/**
 * A pause, said beside an item: "Paused until Sat 18 Oct", or "Paused from Mon 13 Oct to Sat 18 Oct" for one
 * still to come. The days named are the first and last days off.
 * @param {Object} pause - { from, until }
 * @param {String} today - "YYYY-MM-DD"
 */
export const pauseWords = (pause, today) => {
    if (!pause) return "";
    if (pause.from <= today) {
        return pause.until === today ? "Paused today" : `Paused until ${dayRef(pause.until, today)}`;
    }
    return pause.from === pause.until
        ? `Paused ${dayRef(pause.from, today)}`
        : `Paused from ${dayRef(pause.from, today)} to ${dayRef(pause.until, today)}`;
};

/**
 * What the pause form says about the days chosen.
 * @param {Object} span - from: the first day off; days: how many
 */
export const pauseSpanWords = ({ from, days }, today) => {
    const until = addDays(from, days - 1);
    const off =
        days === 1
            ? `Off ${dayRef(from, today)} only.`
            : `Off from ${dayRef(from, today)} to ${dayRef(until, today)}, ${countWord(days).toLowerCase()} days.`;

    return `${off} Back ${dayRef(addDays(until, 1), today)}. Days off cost nothing and don’t break a run.`;
};

export const pausedWords = (title, pause, today) =>
    pause.from <= today
        ? `“${title}” paused until ${dayRef(pause.until, today)}`
        : `“${title}” will pause from ${dayRef(pause.from, today)}`;
export const resumedWords = (title) => `“${title}” is back from today`;
export const notPausedWords = (title) => `“${title}” wasn’t paused.`;
export const notResumedWords = (title) => `“${title}” is still paused.`;
// One that was on the page for a moment as its form gave it, and that the server would not take
export const notSavedWords = (title, changed) => `“${title}” wasn’t ${changed ? "changed" : "added"}`;
export const notRestoredWords = (title) => `“${title}” didn’t come back.`;
export const notReorderedWords = "The new order didn’t save.";
