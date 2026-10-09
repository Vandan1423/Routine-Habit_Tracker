// To-do lists, laid out for the screen. Like lib/day.js, everything here is worked out from its arguments.

import { localDay } from "./dates";

// The list every account has from the start. It is named here, not by what the server stores.
export const GENERAL_LIST_LABEL = "To-do";

export const listLabel = (list) => (list?.isDefault ? GENERAL_LIST_LABEL : (list?.name ?? ""));

// The oldest first: a list is read in the order it was written
const byMade = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
// The most recently finished first
const byDone = (a, b) => String(b.doneAt ?? "").localeCompare(String(a.doneAt ?? ""));

/**
 * One list as it is shown.
 * @param {Object} list - as GET /todos returns it, with its to-dos
 * @returns {Object} - id, label, isDefault; open: what is still to do, in the order it was written;
 *   done: what is finished, the latest first; total
 */
export const layoutList = (list) => {
    const todos = list?.todos ?? [];

    return {
        id: list?._id ?? null,
        label: listLabel(list),
        isDefault: Boolean(list?.isDefault),
        open: todos.filter((todo) => !todo.done).sort(byMade),
        done: todos.filter((todo) => todo.done).sort(byDone),
        total: todos.length,
    };
};

// The list an address names, or the general one when it names none or one that is not there
export const pickList = (lists, id) =>
    lists.find((list) => list._id === id) ?? lists.find((list) => list.isDefault) ?? lists[0] ?? null;

/**
 * What Today shows of the general list: what is still open, and what was ticked today, each in the place
 * it was written, so ticking one does not move it. At most `limit` of them; `more` says how many open ones
 * that left out.
 * @param {Array} lists - as GET /todos returns them
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @param {Number} [options.limit]
 */
export const todayTodos = (lists, { now = new Date(), limit = 6 } = {}) => {
    const general = lists.find((list) => list.isDefault);
    if (!general) return { listId: null, rows: [], open: 0, more: 0 };

    const today = localDay(now);
    const open = general.todos.filter((todo) => !todo.done);
    const relevant = general.todos
        .filter((todo) => !todo.done || (todo.doneAt && localDay(new Date(todo.doneAt)) === today))
        .sort(byMade);
    const rows = relevant.slice(0, limit);

    return {
        listId: general._id,
        rows,
        open: open.length,
        more: open.filter((todo) => !rows.includes(todo)).length,
    };
};

// Every to-do still open, on every list, each with the list it is on: what the command menu offers to tick
export const openTodos = (lists) =>
    lists.flatMap((list) =>
        list.todos.filter((todo) => !todo.done).map((todo) => ({ ...todo, listLabel: listLabel(list) })),
    );

// ── Changes, each giving the lists as they stand after it ──

const inList = (lists, listId, change) =>
    lists.map((list) => (list._id === listId ? { ...list, todos: change(list.todos) } : list));

export const withTodo = (lists, todo) =>
    inList(lists, todo.list, (todos) =>
        todos.some((entry) => entry._id === todo._id)
            ? todos.map((entry) => (entry._id === todo._id ? todo : entry))
            : [...todos, todo],
    );

export const withoutTodos = (lists, ids) => {
    const gone = new Set(ids);
    return lists.map((list) => ({ ...list, todos: list.todos.filter((todo) => !gone.has(todo._id)) }));
};

// A to-do changed in place, or carried to another list when the change names one
export const withTodoChanged = (lists, todo, fields) => {
    const next = { ...todo, ...fields };
    return next.list === todo.list ? withTodo(lists, next) : withTodo(withoutTodos(lists, [todo._id]), next);
};

export const withList = (lists, list) =>
    lists.some((entry) => entry._id === list._id)
        ? lists.map((entry) => (entry._id === list._id ? { ...entry, ...list, todos: list.todos ?? entry.todos } : entry))
        : [...lists, { todos: [], ...list }];

export const withoutList = (lists, id) => lists.filter((list) => list._id !== id);
