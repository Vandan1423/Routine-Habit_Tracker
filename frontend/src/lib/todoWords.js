// The words said about to-dos: in toasts, under headings, and to a screen reader.

import { formatDayBrief, weekdayOf } from "./dates";
import { countWord } from "./dayMessage";
import { formatTimeRange } from "./time";
import { weekdayName } from "./week";

const named = (title) => `“${title}”`;
const todos = (count) => (count === 1 ? "to-do" : "to-dos");

// The line under the screen's title: how much one list holds
export const listWords = (layout) => {
    if (!layout || layout.total === 0) return "Nothing on this list yet.";
    if (layout.open.length === 0) return "Everything on this list is done.";

    const open = `${countWord(layout.open.length)} to do`;
    return layout.done.length > 0 ? `${open}, ${countWord(layout.done.length).toLowerCase()} done.` : `${open}.`;
};

export const TODO_PLACEHOLDER = "Add a to-do";

// Under Today's section, when the list holds more than the section shows
export const moreOnListWords = (count) => `${countWord(count)} more on the list`;

// After a to-do was added from somewhere other than its list
export const addedWords = (label) => `Added to ${label}`;

export const todoGoneWords = (todo) => `${named(todo.title)} moved to Trash`;
export const listGoneWords = (list, count) => ({
    message: `${named(list.name)} moved to Trash`,
    detail: count > 0 ? `With the ${count === 1 ? "one to-do" : `${countWord(count).toLowerCase()} to-dos`} on it.` : undefined,
});
export const clearedWords = (count) =>
    `${countWord(count)} finished ${todos(count)} moved to Trash`;

export const NOT_SAVED_WORDS = "That didn’t save. Check your connection and try again.";
// A to-do that was on its list for a moment and could not be saved. The server's own reason, where it gave one.
export const notAddedWords = (title, failure) => ({
    message: `${named(title)} wasn’t added`,
    detail: failure?.cause?.response ? failure.message : "Check your connection and try again.",
});
export const NOT_DELETED_WORDS = "That wasn’t deleted. Check your connection and try again.";
export const NOT_PLANNED_WORDS = "That didn’t move. Check your connection and try again.";
export const NOT_RESTORED_WORDS = "That didn’t come back. It is still in Trash.";

// A list that was among the lists for a moment and could not be saved. The server's own reason, where it gave one.
export const listNotMadeWords = (name, failure) => ({
    message: `${named(name)} wasn’t made`,
    detail: failure?.cause?.response ? failure.message : "Check your connection and try again.",
});

// What a list's name may be, as the form says it
export const listNameError = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return "Give the list a name.";
    if (trimmed.length > 60) return "Keep the name under 60 characters.";
    return "";
};

export const TODO_MAX = 200;

// ── Planned for a day ──

/**
 * The day a to-do is planned for, as it is said beside it: "Today", "Tomorrow", "Thursday" within the
 * week either side, "Thu 22 Oct" further off; with its time where it has one.
 * today: "YYYY-MM-DD". withDay: false leaves the day out (where the day is plain from what is around it).
 */
export const plannedWords = (todo, today, { withDay = true } = {}) => {
    const time = todo.time ? formatTimeRange(todo.time, todo.endTime) : "";
    if (!todo.date || !withDay) return time;

    const away = (Date.parse(`${todo.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    const day =
        away === 0
            ? "Today"
            : away === 1
              ? "Tomorrow"
              : away === -1
                ? "Yesterday"
                : Math.abs(away) < 7
                  ? weekdayName(weekdayOf(todo.date))
                  : formatDayBrief(todo.date);

    return time ? `${day}, ${time}` : day;
};

// Over what was left from earlier days, on Today
export const leftOverWords = (count) =>
    count === 1 ? "One left from an earlier day." : `${countWord(count)} left from earlier days.`;

// Under what Today shows of those, when there are more
export const moreEarlierWords = (count) => `${countWord(count)} more from earlier days, on Week`;

export const moveToTodayWords = (count) => (count === 1 ? "Move to today" : `Move ${count === 2 ? "both" : "all"} to today`);

// A day as it is said inside a sentence: "today", "tomorrow", "Thursday", "Thu 22 Oct"
export const dayInline = (date, today) => {
    const word = plannedWords({ date }, today);
    return ["Today", "Tomorrow", "Yesterday"].includes(word) ? word.toLowerCase() : word;
};

// After a to-do was moved from one day to another, or off its day
export const movedToWords = (todo, date, today) =>
    date ? `${named(todo.title)} moved to ${dayInline(date, today)}` : `${named(todo.title)} taken off its day`;

export const PAST_DAY_WORDS = "A to-do can be planned for today or a day still to come.";
