// What Archive says about the routines and habits in it. Worked out from its arguments alone,
// like the other word files.

import { formatDayBrief, localDay } from "./dates";
import { countWord } from "./dayMessage";
import { detailWords, patternWords } from "./itemWords";
import { findPlanItem } from "./plan";

const named = (title) => `“${title}”`;
const times = (count) =>
    count === 0 ? "never done" : count === 1 ? "done once" : count === 2 ? "done twice" : `done ${countWord(count).toLowerCase()} times`;

/**
 * Archive's routines and habits as one list, the most recently retired first.
 * @param {Object} data - what GET /archive answers: { routines, habits }
 * @returns {Array} - each { kind, key, item }: item as the plan would lay it out (lib/plan.js), with its source
 */
export const archivedItems = ({ routines = [], habits = [] } = {}) =>
    [
        ...routines.map((routine) => ({ kind: "routine", source: routine })),
        ...habits.map((habit) => ({ kind: "habit", source: habit })),
    ]
        .map(({ kind, source }) => ({
            kind,
            key: `${kind}:${source._id}`,
            item: findPlanItem(kind === "routine" ? { routines: [source] } : { habits: [source] }, kind, source._id),
        }))
        .sort((a, b) => Date.parse(b.item.source.archivedAt) - Date.parse(a.item.source.archivedAt));

// The line under its name: what it is and when it fell
export const archivedFactsWords = (item, { today, firstDay } = {}) =>
    [item.kind === "routine" ? "Routine" : "Habit", patternWords(item, { today, firstDay }), detailWords(item)]
        .filter(Boolean)
        .join(" · ");

// The line after that: when it was retired, and how it went while it was kept
export const archivedWhenWords = (source) => {
    const day = source.archivedAt ? formatDayBrief(localDay(new Date(source.archivedAt))) : null;
    const done = times(source.timesDone ?? 0);

    return day ? `Retired ${day} · ${done}` : done;
};

/**
 * The line under the screen's title.
 * @param {Number} count - how many things are in Archive
 */
export const archiveWords = (count) => {
    if (count === 0) return "What you retire is kept here for good.";
    return count === 1
        ? "One routine or habit, kept with its history."
        : `${countWord(count)} routines and habits, kept with their history.`;
};

export const ARCHIVE_EMPTY_WORDS =
    "When a routine or habit has run its course, retire it from its menu on Plan instead of deleting it. " +
    "It waits here with its whole history, for good, and can be brought back whenever you want it again.";

export const archiveDeletedWords = (title) => `${named(title)} moved to Trash`;
export const NOT_ARCHIVE_DELETED_WORDS = "That wasn’t deleted. Check your connection and try again.";
