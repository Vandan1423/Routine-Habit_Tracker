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

// Planned for a day: the ones with a time first, by the clock, then the rest in the order they were written
export const byPlannedTime = (a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || byMade(a, b);
    if (a.time) return -1;
    if (b.time) return 1;
    return byMade(a, b);
};

const allTodos = (lists) => lists.flatMap((list) => list.todos.map((todo) => ({ ...todo, listLabel: listLabel(list) })));

// Every to-do planned for a day, on any list, each with the name of its list, in the order the day is read
export const plannedOn = (lists, date) =>
    allTodos(lists)
        .filter((todo) => todo.date === date)
        .sort(byPlannedTime);

// What is still to do and has no day: what can be planned for one
export const unplanned = (lists) =>
    allTodos(lists)
        .filter((todo) => !todo.date && !todo.done)
        .sort(byMade);

// What was planned for a day before `date` and is still not done, the oldest day first
export const leftOver = (lists, date) =>
    allTodos(lists)
        .filter((todo) => todo.date && todo.date < date && !todo.done)
        .sort((a, b) => a.date.localeCompare(b.date) || byPlannedTime(a, b));

/**
 * What Today shows of the to-dos, in three runs, each in the place it was written so ticking one does
 * not move it:
 * earlier: what was planned for a day that has passed and is still not done (nothing moves it but the person);
 * planned: what is planned for today, on any list, those with a time first;
 * rows: the general list's own to-dos with no day, still open or ticked today, at most `limit` of them.
 * `more` says how many open ones on the general list that left out; `open`, how many are open in all three.
 * @param {Array} lists - as GET /todos returns them
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @param {String} [options.today] - the account's own day, "YYYY-MM-DD"; this device's day when left out
 * @param {Number} [options.limit]
 */
export const todayTodos = (lists, { now = new Date(), today = localDay(now), limit = 6 } = {}) => {
    const general = lists.find((list) => list.isDefault);
    if (!general) return { listId: null, earlier: [], planned: [], rows: [], open: 0, more: 0 };

    const tickedToday = (todo) => todo.doneAt && localDay(new Date(todo.doneAt)) === localDay(now);
    const open = general.todos.filter((todo) => !todo.done && !todo.date);
    const relevant = general.todos
        .filter((todo) => !todo.date && (!todo.done || tickedToday(todo)))
        .sort(byMade);
    const rows = relevant.slice(0, limit);
    const earlier = leftOver(lists, today);
    const planned = plannedOn(lists, today);

    return {
        listId: general._id,
        earlier,
        planned,
        rows,
        open: open.length + earlier.length + planned.filter((todo) => !todo.done).length,
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

// Some of a to-do's fields changed, wherever it is now; it is carried to another list when the change
// names one. A to-do that is no longer on any list is left alone.
export const withTodoFields = (lists, id, fields) => {
    const found = lists.flatMap((list) => list.todos).find((todo) => todo._id === id);
    if (!found) return lists;

    const next = { ...found, ...fields };
    return next.list === found.list ? withTodo(lists, next) : withTodo(withoutTodos(lists, [id]), next);
};

export const withList = (lists, list) =>
    lists.some((entry) => entry._id === list._id)
        ? lists.map((entry) => (entry._id === list._id ? { ...entry, ...list, todos: list.todos ?? entry.todos } : entry))
        : [...lists, { todos: [], ...list }];

export const withoutList = (lists, id) => lists.filter((list) => list._id !== id);

// A list written here takes the id the server saved it under, and so does everything written on it since
export const withListSaved = (lists, draftId, saved) =>
    lists.map((list) =>
        list._id === draftId
            ? { ...saved, ...list, _id: saved._id, todos: list.todos.map((todo) => ({ ...todo, list: saved._id })) }
            : list,
    );

// A list as it is shown the moment it is named, before the server has it
export const draftList = (id, name, now = new Date()) => ({
    _id: id,
    name,
    isDefault: false,
    createdAt: now.toISOString(),
    todos: [],
});

// A list put back in the place it was taken from
export const withListAt = (lists, list, index) =>
    lists.some((entry) => entry._id === list._id)
        ? lists
        : index < 0
          ? [...lists, list]
          : [...lists.slice(0, index), list, ...lists.slice(index)];

// ── A to-do that has been written here and that the server has not answered for yet ──

/**
 * A to-do as it is shown the moment it is written. Until the server has saved it, its id is one of ours.
 * It is dated after everything already on its list, whatever this device's clock says, so it lands last.
 * @param {String} id - told apart from a saved one's by whoever makes it
 * @param {Object} list - the list it is written on, with its to-dos
 */
export const draftTodo = (id, title, list, now = new Date(), planned = {}) => {
    const last = list.todos.reduce((latest, todo) => Math.max(latest, Date.parse(todo.createdAt) || 0), 0);

    return {
        _id: id,
        list: list._id,
        title,
        done: false,
        doneAt: null,
        date: planned.date ?? null,
        time: planned.date ? (planned.time ?? null) : null,
        endTime: planned.date && planned.time ? (planned.endTime ?? null) : null,
        createdAt: new Date(Math.max(now.getTime(), last + 1)).toISOString(),
    };
};

// A draft takes the id the server saved it under. Whatever was changed on it while it waited stays as it
// is here (that is sent next), and so does its place on the list.
export const withDraftSaved = (lists, draftId, saved) =>
    lists.map((list) => ({
        ...list,
        todos: list.todos.map((todo) =>
            todo._id === draftId ? { ...saved, ...todo, _id: saved._id, key: draftId } : todo,
        ),
    }));

// What a to-do's row is told apart by. One that began here as a draft keeps the key it was first drawn
// under, so its row stays where it is when the server's id arrives.
export const rowKey = (todo) => todo.key ?? todo._id;

/**
 * Lists fresh from the server, with those rows' keys put back on them.
 * @param {Map} keys - saved id => the key its row was first drawn under
 */
export const withKeys = (lists, keys) =>
    keys.size === 0
        ? lists
        : lists.map((list) => ({
              ...list,
              todos: list.todos.map((todo) => (keys.has(todo._id) ? { ...todo, key: keys.get(todo._id) } : todo)),
          }));

export const holdsTodo = (lists, id) => lists.some((list) => list.todos.some((todo) => todo._id === id));
