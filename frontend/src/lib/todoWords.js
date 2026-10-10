// The words said about to-dos: in toasts, under headings, and to a screen reader.

import { countWord } from "./dayMessage";

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
