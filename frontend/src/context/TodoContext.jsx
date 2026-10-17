import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../hooks/useAuth";
import { adoptDraft, newDraftId } from "../lib/drafts";
import { toast } from "../lib/toast";
import {
    draftList,
    draftTodo,
    holdsTodo,
    withDraftSaved,
    withKeys,
    withList,
    withListAt,
    withListSaved,
    withoutList,
    withoutTodos,
    withTodo,
    withTodoFields,
} from "../lib/todos";
import {
    clearedWords,
    listGoneWords,
    listNotMadeWords,
    NOT_DELETED_WORDS,
    NOT_PLANNED_WORDS,
    NOT_RESTORED_WORDS,
    NOT_SAVED_WORDS,
    todoGoneWords,
} from "../lib/todoWords";
import { hold, newKey } from "../services/outbox";
import todoService from "../services/todoService";
import trashService from "../services/trashService";

/*
 * The to-do lists: the general list every account has, and the named ones. They are shown in three
 * places (their own screen, a section of Today, the command menu), so there is one copy of them, here.
 *
 * Every change is shown first and sent after: a tick, a new name, a delete, and a new to-do or a new
 * list too, which is there the moment it is written and takes the server's id when that arrives. If the
 * server refuses, that one change is taken back and the screen says so. What is deleted goes to Trash,
 * and a toast offers to bring it back.
 */

const EMPTY = {
    status: "idle", // "idle" until first asked for, then "loading", then "ready" or "error"
    lists: [],
    error: null,
};

const TodoContext = createContext(null);

export const TodoProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();

    const [state, setState] = useState(EMPTY);

    const latest = useRef({ state: EMPTY });
    const loading = useRef(false);
    const ticket = useRef(0);
    // Goes up with every change made here. Lists requested before a change may not replace what is shown.
    const changes = useRef(0);
    // What is on its way to the server. Until it has all arrived the server's lists are not the whole truth,
    // so they are not put on screen; `behind` remembers that they were asked for and are still owed.
    const flying = useRef(new Set());
    const behind = useRef(false);
    // The to-dos and lists written here, by the id each was first drawn under: each as the server saved it
    // (a promise; null if it never was) and the id it has now. And the other way: the key a saved to-do's
    // row keeps.
    const births = useRef(new Map());
    const names = useRef(new Map());
    const keys = useRef(new Map());
    const drafted = useRef(0);
    // A to-do the server never answered for, by its list and words: written again, it is sent under the key
    // it had, so that if the server did save it the first time there is still only one
    const unanswered = useRef(new Map());
    // New to-dos go to the server one after another, so a list is saved in the order it was written
    const line = useRef(Promise.resolve());

    const load = useCallback(async ({ quiet = false } = {}) => {
        const mine = ++ticket.current;
        const changesAtStart = changes.current;
        loading.current = true;

        if (!quiet) {
            setState((current) =>
                current.status === "ready" ? current : { ...current, status: "loading", error: null },
            );
        }

        try {
            const lists = await todoService.getLists();
            if (mine !== ticket.current) return;
            if (flying.current.size > 0) {
                behind.current = true;
                return;
            }
            if (changesAtStart !== changes.current) {
                load({ quiet: true });
                return;
            }

            setState({ status: "ready", lists: withKeys(lists, keys.current), error: null });
        } catch (error) {
            if (mine !== ticket.current) return;

            // A refresh behind the scenes that fails leaves what is on screen alone
            setState((current) =>
                current.status === "ready" ? current : { ...current, status: "error", error },
            );
        } finally {
            if (mine === ticket.current) loading.current = false;
        }
    }, []);

    // Called by whatever shows the lists: loads them the first time, and refreshes them quietly after that
    const ensure = useCallback(() => {
        if (loading.current) return;

        load({ quiet: latest.current.state.status === "ready" });
    }, [load]);

    const refresh = useCallback(() => load({ quiet: true }), [load]);

    const change = useCallback((next) => {
        changes.current += 1;
        setState((current) => ({ ...current, lists: next(current.lists) }));
    }, []);

    // Counts something as on its way to the server until it is answered, then reads the lists if they are owed
    const flight = useCallback(
        (request) => {
            const landed = () => {
                flying.current.delete(request);
                changes.current += 1;

                if (flying.current.size === 0 && behind.current) {
                    behind.current = false;
                    load({ quiet: true });
                }
            };

            flying.current.add(request);
            request.then(landed, landed);
            return request;
        },
        [load],
    );

    /**
     * Shows a change at once, sends it, and takes that one change back if the server refuses.
     * shown, undo: (lists) => lists. send: () => a promise of the server's answer.
     */
    const attempt = useCallback(
        async (shown, send, { undo, words = NOT_SAVED_WORDS, retry } = {}) => {
            change(shown);

            try {
                return await flight(send());
            } catch {
                change(undo);
                toast.error(words, retry && { action: { label: "Try again", onClick: retry } });
                return null;
            }
        },
        [change, flight],
    );

    // A to-do or a list written here is known by two ids, one after the other. The one it has now:
    const idNow = useCallback((thing) => names.current.get(thing._id) ?? thing._id, []);
    // To-dos held from before a request, as they stand after it, for putting them back: each under the id
    // it has now, and without any that were never saved
    const standing = useCallback(
        (todos) =>
            todos
                .filter((todo) => !births.current.has(todo._id) || names.current.has(todo._id))
                .map((todo) => (idNow(todo) === todo._id ? todo : { ...todo, _id: idNow(todo), key: todo._id })),
        [idNow],
    );
    // The to-do or list as the server has it. One written a moment ago is waited for (and until it is
    // here, whatever waits on it cannot be written down to be sent later); null if it was never saved.
    const onceSaved = useCallback(
        (thing) => (births.current.has(thing._id) ? hold(births.current.get(thing._id)) : thing),
        [],
    );

    /**
     * Adds a to-do. It is on its list at once and sent after. Resolves with it as saved; rejects with the
     * server's reason once it has been taken off the list again, for whoever asked to say so.
     * @param {String} title
     * @param {String} [listId] - the general list when left out
     * @param {Object} [planned] - { date, time, endTime }, any of them, for one planned for a day (Week)
     */
    const addTodo = useCallback(
        (title, listId, planned = {}) => {
            const home = latest.current.state.lists.find((list) => (listId ? list._id === listId : list.isDefault));

            // The lists are not here yet, so there is nowhere to show it: this one waits for the server
            if (!home) {
                return todoService.createTodo(title, listId, undefined, planned).then((todo) => {
                    change((lists) => withTodo(lists, todo));
                    return todo;
                });
            }

            drafted.current += 1;
            const draft = draftTodo(`draft:${drafted.current}`, title, home, new Date(), planned);
            change((lists) => withTodo(lists, draft));

            const again = `${home._id}\n${title}\n${planned.date ?? ""}`;
            const key = unanswered.current.get(again) ?? newKey();
            unanswered.current.delete(again);

            // Until the ones written before it have gone, this one has not been sent or written down
            const created = hold(line.current).then(async () => {
                const list = listId ? await onceSaved({ _id: listId }) : null;
                if (listId && !list) throw new Error(NOT_SAVED_WORDS);

                return todoService.createTodo(title, list?._id, key, planned);
            });
            line.current = created.catch(() => {});

            const answer = created.then(
                (todo) => {
                    names.current.set(draft._id, todo._id);
                    keys.current.set(todo._id, draft._id);
                    change((lists) => withDraftSaved(lists, draft._id, todo));
                    return { todo };
                },
                (reason) => {
                    // Deleted here before the server answered: there is nothing left to say about it
                    const wanted = holdsTodo(latest.current.state.lists, draft._id);
                    change((lists) => withoutTodos(lists, [draft._id]));
                    // No answer at all is not a refusal: the server may have saved it. The lists are read
                    // again, so that it shows if it did, and the key is kept for when it is written again.
                    if (!reason?.cause?.response) {
                        behind.current = true;
                        unanswered.current.set(again, key);
                    }
                    return { todo: null, reason: wanted ? reason : null };
                },
            );
            births.current.set(draft._id, answer.then(({ todo }) => todo));
            flight(answer);

            return answer.then(({ todo, reason }) => {
                if (reason) throw reason;
                return todo;
            });
        },
        [change, flight, onceSaved],
    );

    // Changes some of a to-do's fields: shown at once, sent once the server has the to-do, put back if it refuses
    const alter = useCallback(
        (todo, fields, body, options) => {
            const was = Object.fromEntries(Object.keys(fields).map((field) => [field, todo[field]]));

            return attempt(
                (lists) => withTodoFields(lists, idNow(todo), fields),
                async () => {
                    const known = await onceSaved(todo);
                    return known ? todoService.updateTodo(known._id, await body()) : null;
                },
                { ...options, undo: (lists) => withTodoFields(lists, idNow(todo), was) },
            );
        },
        [attempt, idNow, onceSaved],
    );

    // Tick or un-tick one. Sent as the state wanted, so sending it twice changes nothing.
    const setDone = useCallback(
        (todo, done) =>
            alter(todo, { done, doneAt: done ? new Date().toISOString() : null }, () => ({ done }), {
                retry: () => latest.current.setDone(todo, done),
            }),
        [alter],
    );

    const renameTodo = useCallback((todo, title) => alter(todo, { title }, () => ({ title })), [alter]);

    // The list it goes to may itself have been made a moment ago
    const moveTodo = useCallback(
        (todo, listId) =>
            alter(todo, { list: listId }, async () => ({ listId: (await onceSaved({ _id: listId }))?._id })),
        [alter, onceSaved],
    );

    /**
     * Plans one for a day, moves it to another, gives it a time, or takes it off its day: any of
     * { date, time, endTime }, null for none. Taking away the day takes the time with it, as the server does.
     * Shown at once, put back if the server refuses (it refuses a day that has passed).
     */
    const planTodo = useCallback(
        (todo, planned) => {
            const fields = { ...planned };
            if (fields.date === null) Object.assign(fields, { time: null, endTime: null });
            if (fields.time === null) fields.endTime = null;

            return alter(todo, fields, () => fields, {
                words: NOT_PLANNED_WORDS,
                retry: () => latest.current.planTodo(todo, planned),
            });
        },
        [alter],
    );

    // Brings back what a delete here sent to Trash, then reads the lists again: only the server knows how they stand
    const bringBack = useCallback(
        async (kind, ids) => {
            const answers = await Promise.allSettled(ids.map((id) => trashService.restore(kind, id)));
            if (answers.some((answer) => answer.status === "rejected")) toast.error(NOT_RESTORED_WORDS);

            changes.current += 1;
            load({ quiet: true });
        },
        [load],
    );

    const deleteTodo = useCallback(
        async (todo) => {
            const sent = await attempt(
                (lists) => withoutTodos(lists, [idNow(todo)]),
                async () => {
                    const known = await onceSaved(todo);
                    // Written and deleted before it was saved, and then never saved: there is nothing in Trash
                    return known ? todoService.deleteTodo(known._id) : null;
                },
                {
                    undo: (lists) => standing([todo]).reduce(withTodo, lists),
                    words: NOT_DELETED_WORDS,
                    retry: () => latest.current.deleteTodo(todo),
                },
            );
            if (!sent) return false;

            const id = idNow(todo);
            toast(todoGoneWords(todo), {
                id: `todo-deleted-${id}`,
                action: { label: "Undo", onClick: () => bringBack("todo", [id]) },
            });
            return true;
        },
        [attempt, bringBack, idNow, standing, onceSaved],
    );

    // Moves a list's finished to-dos to Trash
    const clearDone = useCallback(
        async (list) => {
            const finished = list.todos.filter((todo) => todo.done);
            if (finished.length === 0) return;

            // The server clears what it knows to be finished, so every tick made here has to reach it first
            const earlier = Promise.allSettled([...flying.current]);
            const sent = await attempt(
                (lists) => withoutTodos(lists, finished.map(idNow)),
                async () => {
                    await earlier;
                    return todoService.clearDone(list._id);
                },
                {
                    undo: (lists) => standing(finished).reduce(withTodo, lists),
                    words: NOT_DELETED_WORDS,
                },
            );
            if (!sent) return;

            toast(clearedWords(sent.ids.length), {
                id: `todo-cleared-${list._id}`,
                action: { label: "Undo", onClick: () => bringBack("todo", sent.ids) },
            });
            // One of those ticks never reached the server, so it is still on the list there
            if (sent.ids.length !== finished.length) load({ quiet: true });
        },
        [attempt, bringBack, idNow, standing, load],
    );

    /**
     * Makes a named list. It is among the lists at once, and can be written on at once; it is returned
     * as it stands until the server has it. If the server refuses, it is taken away and a toast says so.
     * @param {String} [key] - the key it was sent under before, when this is a second try
     */
    const addList = useCallback(
        (name, key = newKey()) => {
            const draft = draftList(newDraftId("list"), name);
            change((lists) => withList(lists, draft));

            const answer = todoService.createList(name, key).then(
                (list) => {
                    names.current.set(draft._id, list._id);
                    adoptDraft(draft._id, list._id);
                    change((lists) => withListSaved(lists, draft._id, list));
                    return list;
                },
                (failure) => {
                    const words = listNotMadeWords(name, failure);

                    change((lists) => withoutList(lists, draft._id));
                    toast.error(words.message, {
                        detail: words.detail,
                        action: { label: "Try again", onClick: () => latest.current.addList(name, key) },
                    });
                    return null;
                },
            );
            births.current.set(draft._id, answer);
            flight(answer);

            return draft;
        },
        [change, flight],
    );

    // Renames one: shown at once, put back if the server refuses
    const renameList = useCallback(
        (list, name) =>
            attempt(
                (lists) => withList(lists, { _id: idNow(list), name }),
                async () => {
                    const known = await onceSaved(list);
                    return known ? todoService.renameList(known._id, name) : null;
                },
                { undo: (lists) => withList(lists, { _id: idNow(list), name: list.name }) },
            ),
        [attempt, idNow, onceSaved],
    );

    // The id a list goes by now, for an address that still names it as it was before the server had it
    const listIdNow = useCallback((id) => names.current.get(id) ?? id, []);

    const deleteList = useCallback(
        async (list) => {
            const place = latest.current.state.lists.findIndex((entry) => entry._id === list._id);
            // What was written on it a moment ago goes to Trash with it, so that has to be saved first
            const earlier = Promise.allSettled([...flying.current]);
            const sent = await attempt(
                (lists) => withoutList(lists, idNow(list)),
                async () => {
                    await earlier;
                    const known = await onceSaved(list);
                    // Named and deleted before it was saved, and then never saved: there is nothing in Trash
                    return known ? todoService.deleteList(known._id) : null;
                },
                {
                    undo: (lists) => withListAt(lists, { ...list, _id: idNow(list), todos: standing(list.todos) }, place),
                    words: NOT_DELETED_WORDS,
                },
            );
            if (!sent) return false;

            const words = listGoneWords(list, sent.todos ?? 0);
            toast(words.message, {
                id: `todo-list-deleted-${idNow(list)}`,
                detail: words.detail,
                action: { label: "Undo", onClick: () => bringBack("todoList", [idNow(list)]) },
            });
            return true;
        },
        [attempt, bringBack, idNow, onceSaved, standing],
    );

    useEffect(() => {
        latest.current = { state, setDone, deleteTodo, addList, planTodo };
    });

    // Signing out, or signing in as someone else, starts from nothing
    const userId = isAuthenticated ? (user?._id ?? user?.id ?? user?.email ?? "") : null;
    useEffect(
        () => () => {
            ticket.current += 1;
            loading.current = false;
            setState(EMPTY);
        },
        [userId],
    );

    const value = useMemo(
        () => ({
            ...state,
            ensure,
            retry: load,
            refresh,
            addTodo,
            setDone,
            renameTodo,
            moveTodo,
            planTodo,
            deleteTodo,
            clearDone,
            addList,
            renameList,
            deleteList,
            listIdNow,
        }),
        [
            state,
            ensure,
            load,
            refresh,
            addTodo,
            setDone,
            renameTodo,
            moveTodo,
            planTodo,
            deleteTodo,
            clearDone,
            addList,
            renameList,
            deleteList,
            listIdNow,
        ],
    );

    return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};

export { TodoContext };
