// What Trash says about the things in it: what each is, when it goes for good, and what was done with it.
// Worked out from its arguments alone, like the other word files.

import { formatDayShort } from "./dates";
import { countWord } from "./dayMessage";
import { detailWords, patternWords } from "./itemWords";
import { formatMoney } from "./money";
import { findPlanItem } from "./plan";
import { GENERAL_LIST_LABEL } from "./todos";

const NBSP = " ";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const numberFormat = new Intl.NumberFormat();
const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;
const named = (title) => `“${title}”`;

// How long Trash may keep things, as the account chooses it
export const TRASH_DAYS_OPTIONS = [
    { value: 1, label: "1 day" },
    { value: 3, label: "3 days" },
    { value: 7, label: "1 week" },
];
export const DEFAULT_TRASH_DAYS = 7;

const lengthWords = (days) =>
    TRASH_DAYS_OPTIONS.find((option) => option.value === days)?.label ?? `${days} days`;

// The kinds whose XP goes into Trash with them
const HOLDS_XP = new Set(["routine", "habit"]);

const TRANSACTION_WORDS = { expense: "Expense", income: "Income", transfer: "Transfer" };
const EVERY = { weekly: "every week", monthly: "every month", yearly: "every year" };

// What kind of thing it is, in a word or two
export const kindWords = (item) => {
    if (item.kind === "routine") return item.isRecurring ? "Routine" : "One-off task";
    if (item.kind === "habit") return "Habit";
    if (item.kind === "transaction") return TRANSACTION_WORDS[item.type] ?? "Transaction";
    if (item.kind === "subscription") return "Subscription";
    if (item.kind === "todo") return "To-do";
    if (item.kind === "todoList") return "List";
    return "Goal";
};

// What it goes by. A transaction with no description is named by where it was spent, or what on.
export const titleOf = (item) => {
    if (item.kind !== "transaction") return item.title;

    const place = item.placeName && item.placeName !== "Other" ? item.placeName : "";
    return item.title || place || item.category || kindWords(item);
};

// A routine or habit, as the plan would lay it out, from the few facts Trash is told about it
const asPlanItem = (item) =>
    item.kind === "routine"
        ? findPlanItem({ routines: [{ ...item, _id: item.id }] }, "routine", item.id)
        : findPlanItem({ habits: [{ ...item, _id: item.id }] }, "habit", item.id);

/**
 * The facts that tell it from others like it, in the order they are read: when a routine falls,
 * what an expense came to and on which day, which list a to-do was on.
 * @param {Object} item - one of GET /trash's items
 * @param {Object} [options] - today: "YYYY-MM-DD"; firstDay: the day the reader's week starts on
 * @returns {Array} - short pieces of text
 */
export const factsOf = (item, { today, firstDay } = {}) => {
    if (item.kind === "routine" || item.kind === "habit") {
        const planned = asPlanItem(item);
        return [patternWords(planned, { today, firstDay }), detailWords(planned)];
    }
    if (item.kind === "transaction") {
        return [
            formatMoney(item.amount),
            item.date ? formatDayShort(item.date) : "",
            item.type === "transfer" && item.toAccount ? `${item.account} to ${item.toAccount}` : item.account,
        ];
    }
    if (item.kind === "subscription") {
        return [`${formatMoney(item.amount)} ${EVERY[item.frequency] ?? ""}`.trim()];
    }
    if (item.kind === "todo") {
        if (!item.list) return [];
        return [`on ${item.list.isDefault ? GENERAL_LIST_LABEL : item.list.name}`];
    }
    if (item.kind === "todoList") {
        return [item.todos > 0 ? `with ${item.todos === 1 ? "one to-do" : `${countWord(item.todos).toLowerCase()} to-dos`}` : "empty"];
    }
    return [item.targetDate ? `by ${formatDayShort(item.targetDate)}` : ""];
};

// The line under its name: what it is, then its facts
export const metaOf = (item, options) =>
    [kindWords(item), ...factsOf(item, options)].filter(Boolean).join(" · ");

// What a routine or habit took with it, to be read beside it
export const heldWords = (item) => (HOLDS_XP.has(item.kind) && item.xp > 0 ? `Holds ${xp(item.xp)}` : "");

/**
 * How long it has left, counted from now.
 * @param {String|Date} purgeAt - when Trash lets go of it
 * @param {Date} [now]
 */
export const goesWords = (purgeAt, now = new Date()) => {
    const left = new Date(purgeAt).getTime() - now.getTime();

    if (left <= HOUR_MS) return "Goes within the hour";
    if (left < DAY_MS) {
        const hours = Math.round(left / HOUR_MS);
        return `Goes in ${hours}${NBSP}${hours === 1 ? "hour" : "hours"}`;
    }

    const days = Math.round(left / DAY_MS);
    return days === 1 ? "Goes tomorrow" : `Goes in ${days}${NBSP}days`;
};

/**
 * The line under the screen's title.
 * @param {Number} count - how many things are in Trash
 * @param {Number} days - how long the account keeps them
 */
export const trashWords = (count, days) => {
    const kept = `kept for ${lengthWords(days)}, then gone for good`;

    if (count === 0) return `What you delete is ${kept}.`;
    return count === 1 ? `One thing, ${kept}.` : `${countWord(count)} things, each ${kept}.`;
};

export const TRASH_DAYS_NOTE =
    "Counted from the moment a thing is deleted. Changing this applies to what you delete from now on.";

// ── What is said when something is done with it ──

// One deleted from Archive goes back there, not into the plan
export const recoveredWords = (item, xpReturned = 0) => ({
    message: `${named(titleOf(item))} recovered${item.archived ? " to Archive" : ""}`,
    detail: xpReturned > 0 ? `Its ${xp(xpReturned)} came back with it.` : undefined,
});

export const NOT_RECOVERED_WORDS = "That didn’t come back. It is still in Trash.";

/**
 * The question asked before one thing is erased for good.
 */
export const eraseWords = (item) => ({
    title: `Erase ${named(titleOf(item))} for good?`,
    description:
        HOLDS_XP.has(item.kind) && item.xp > 0
            ? `It can’t be recovered after this, and the ${xp(item.xp)} it earned stays gone.`
            : "It can’t be recovered after this.",
    confirm: "Erase it",
});

export const emptyWords = (items) => {
    const held = items.reduce((sum, item) => sum + (HOLDS_XP.has(item.kind) ? item.xp || 0 : 0), 0);
    const count = items.length;

    return {
        title: count === 1 ? "Erase the one thing in Trash for good?" : `Erase all ${countWord(count).toLowerCase()} things for good?`,
        description:
            held > 0
                ? `Nothing in Trash can be recovered after this, and the ${xp(held)} these things earned stays gone.`
                : "Nothing in Trash can be recovered after this.",
        confirm: "Empty Trash",
    };
};

export const erasedWords = (item) => `${named(titleOf(item))} erased`;
export const EMPTIED_WORDS = "Trash emptied";
export const NOT_ERASED_WORDS = "That wasn’t erased. Check your connection and try again.";
