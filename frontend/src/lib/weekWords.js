// The words Week says: over the week, under each day, in the review, and in toasts.

import { addDays, formatMonthName, monthOf } from "./dates";
import { countWord } from "./dayMessage";

const numberFormat = new Intl.NumberFormat();
const many = (count, one, more) => `${countWord(count).toLowerCase()} ${count === 1 ? one : more}`;

// "11 to 17 October", "28 September to 4 October": the title of a week
export const weekTitle = (start) => {
    const end = addDays(start, 6);
    const day = (date) => Number(date.slice(8));
    const month = (date) => formatMonthName(monthOf(date));

    return monthOf(start) === monthOf(end)
        ? `${day(start)} to ${day(end)} ${month(end)}`
        : `${day(start)} ${month(start)} to ${day(end)} ${month(end)}`;
};

// The line over the title: which week it is, from where today stands
export const weekName = (start, thisWeek) => {
    const away = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${thisWeek}T00:00:00Z`)) / (7 * 86400000));
    if (away === 0) return "This week";
    if (away === 1) return "Next week";
    if (away === -1) return "Last week";
    return away > 0 ? `In ${countWord(away).toLowerCase()} weeks` : `${countWord(-away)} weeks ago`;
};

/**
 * What the week holds, said after its name: "Nine to-dos planned, four done. 65 of 71 of the plan kept."
 * week: from buildWeek
 */
export const weekSummaryWords = (week) => {
    const { todos, todosDone, due, done } = week.totals;
    const parts = [];

    if (todos === 0) parts.push("Nothing planned yet.");
    else parts.push(`${countWord(todos)} ${todos === 1 ? "to-do" : "to-dos"} planned, ${countWord(todosDone).toLowerCase()} done.`);
    if (due > 0) parts.push(`${numberFormat.format(done)} of ${numberFormat.format(due)} of the plan kept so far.`);

    return parts.join(" ");
};

// Under a day's name: what the plan asked and how it went, or what it will ask
export const dayStandingWords = (day) => {
    const { total, done, missed } = day.standing;
    if (day.when === "ahead") return total > 0 ? `${numberFormat.format(total)} in the plan` : "Nothing in the plan";
    if (total === 0) return "Nothing was due";

    const kept = `${numberFormat.format(done)} of ${numberFormat.format(total)} kept`;
    return day.when === "past" && missed > 0 ? `${kept}, ${numberFormat.format(missed)} missed` : kept;
};

export const FOCUS_HINT = "What would make this week a good one? Up to five things.";
export const FOCUS_PLACEHOLDER = "Add something to focus on";
export const NOTES_PLACEHOLDER = "Anything to remember this week: who to call, what is coming up.";

// The review's figures, each a short line
export const reviewFacts = (week, focus) => {
    const { todos, todosDone, due, done, missed } = week.totals;
    const reached = focus.filter((entry) => entry.done).length;

    return [
        { label: "The plan", value: due > 0 ? `${numberFormat.format(done)} of ${numberFormat.format(due)} kept` : "Nothing was due", note: missed > 0 ? `${numberFormat.format(missed)} missed` : null },
        { label: "To-dos", value: todos > 0 ? `${numberFormat.format(todosDone)} of ${numberFormat.format(todos)} done` : "None planned" },
        { label: "Focus", value: focus.length > 0 ? `${numberFormat.format(reached)} of ${numberFormat.format(focus.length)} reached` : "None set" },
    ];
};

// The best day so far: the most kept, among days that asked something, as a share of what was asked
export const bestDayOf = (week) => {
    const counted = week.days.filter((day) => day.when !== "ahead" && day.standing.total > 0);
    if (counted.length < 2) return null;

    return counted.reduce((best, day) =>
        day.standing.done / day.standing.total > best.standing.done / best.standing.total ? day : best,
    );
};

export const moveOnWords = (count) => `Move ${many(count, "unfinished to-do", "unfinished to-dos")} to next week`;
export const movedOnWords = (count) => `${countWord(count)} ${count === 1 ? "to-do" : "to-dos"} moved to next week`;

export const SOMEDAY_EMPTY = "Everything on your lists has a day. New to-dos with no day wait here.";
export const NOT_SAVED_WEEK = "That didn’t save. Check your connection and try again.";

// To a screen reader, for a cell of the tracker
export const TRACK_WORDS = {
    done: "done",
    late: "done late",
    partial: "partly done",
    missed: "missed",
    none: "nothing on record",
    open: "not done yet",
    ahead: "still to come",
    off: "not asked",
};
