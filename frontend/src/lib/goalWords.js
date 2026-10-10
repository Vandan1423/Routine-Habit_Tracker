// The words said about goals: when one is due, how far along it is, how what carries it has been kept.

import { formatDayShort } from "./dates";
import { countWord } from "./dayMessage";
import { KEPT_DAYS } from "./goals";

const named = (title) => `“${title}”`;
const days = (count) => `${count} ${count === 1 ? "day" : "days"}`;

/**
 * The line under the screen's title.
 * @param {Object} layout - from layoutGoals
 */
export const goalsWords = ({ open, reached }) => {
    if (open.length === 0 && reached.length === 0) return "Nothing set yet.";

    const parts = [
        open.length > 0 && `${countWord(open.length)} under way`,
        reached.length > 0 && `${countWord(reached.length).toLowerCase()} reached`,
    ].filter(Boolean);
    const said = parts.join(", ");

    return `${said.charAt(0).toUpperCase()}${said.slice(1)}.`;
};

/**
 * When a goal is for, said from where today stands.
 * @param {Object} goal - from layoutGoal
 * @returns {Object|null} - { text, late }; null for a goal with no date
 */
export const dateWords = (goal) => {
    if (goal.reached) return { text: `Reached ${formatDayShort(goal.reachedAt.slice(0, 10))}`, late: false };
    if (goal.daysLeft === null) return null;

    const by = `By ${formatDayShort(goal.targetDate)}`;
    if (goal.daysLeft < 0) return { text: `${by}, ${days(-goal.daysLeft)} ago`, late: true };
    if (goal.daysLeft === 0) return { text: `${by}, which is today`, late: false };
    if (goal.daysLeft === 1) return { text: `${by}, which is tomorrow`, late: false };
    return { text: `${by}, ${days(goal.daysLeft)} from now`, late: false };
};

// How many of its milestones are behind it
export const stepsWords = ({ total, done }) => {
    if (total === 0) return "";
    return `${done} of ${total} ${total === 1 ? "milestone" : "milestones"}`;
};

// How a routine or habit that carries a goal has been kept lately
export const keptWords = (link) => {
    if (!link.active) return "No longer in the plan";
    if (!link.kept) return `Nothing on record in the last ${KEPT_DAYS} days`;
    return `Kept ${link.kept.done} of ${days(link.kept.due)} in the last ${KEPT_DAYS}`;
};

export const ALL_DONE_WORDS = "Every milestone is behind you.";

export const KIND_LABEL = { routine: "Routine", habit: "Habit" };

// ── What is said when something is done with one ──

export const goalGoneWords = (goal) => `${named(goal.title)} moved to Trash`;
export const reachedWords = (goal) => `${named(goal.title)} reached`;
export const NOT_SAVED_WORDS = "That didn’t save. Check your connection and try again.";
// A goal that was on the page for a moment as the form gave it, and that the server would not take
export const goalRefusedWords = (title, changed, failure) => ({
    message: `${named(title)} wasn’t ${changed ? "changed" : "added"}`,
    detail: failure?.cause?.response ? failure.message : "Check your connection and try again.",
});
export const NOT_DELETED_WORDS = "That wasn’t deleted. Check your connection and try again.";
export const NOT_RESTORED_WORDS = "That didn’t come back. It is still in Trash.";
