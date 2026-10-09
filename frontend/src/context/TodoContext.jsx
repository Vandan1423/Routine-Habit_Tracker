import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../hooks/useAuth";
import { toast } from "../lib/toast";
import {
    withList,
    withoutList,
    withoutTodos,
    withTodo,
    withTodoChanged,
} from "../lib/todos";
import {
    clearedWords,
    listGoneWords,
    NOT_DELETED_WORDS,
    NOT_RESTORED_WORDS,
    NOT_SAVED_WORDS,
    todoGoneWords,
} from "../lib/todoWords";
import todoService from "../services/todoService";
import trashService from "../services/trashService";

/*
 * The to-do lists: the general list every account has, and the named ones. They are shown in three
 * places (their own screen, a section of Today, the command menu), so there is one copy of them, here.
 *
 * A change to something that is already there (a tick, a new name, a delete) is shown first and sent
 * after; if the server refuses, it is put back and a toast says so. Adding waits for the server, since
 * only the server can say what the new thing is. What is deleted goes to Trash, and a toast offers to
 * bring it back.
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
            if (changesAtStart !== changes.current) {
                load({ quiet: true });
                return;
            }

            setState({ status: "ready", lists, error: null });
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

    // Shows a change at once, sends it, and puts things back as they were if the server refuses
    const attempt = useCallback(
        async (shown, send, { words = NOT_SAVED_WORDS, retry } = {}) => {
            const before = latest.current.state.lists;
            change(shown);

            try {
                return await send();
            } catch {
                change(() => before);
                toast.error(words, retry && { action: { label: "Try again", onClick: retry } });
                return null;
            }
        },
        [change],
    );

    /**
     * Adds a to-do. Resolves with it as saved; rejects with the server's reason, for the field to say.
     * @param {String} title
     * @param {String} [listId] - the general list when left out
     */
    const addTodo = useCallback(
        async (title, listId) => {
            const todo = await todoService.createTodo(title, listId);

            change((lists) => withTodo(lists, todo));
            return todo;
        },
        [change],
    );

    // Tick or un-tick one. Sent as the state wanted, so sending it twice changes nothing.
    const setDone = useCallback(
        (todo, done) =>
            attempt(
                (lists) => withTodoChanged(lists, todo, { done, doneAt: done ? new Date().toISOString() : null }),
                () => todoService.updateTodo(todo._id, { done }),
                { retry: () => latest.current.setDone(todo, done) },
            ),
        [attempt],
    );

    const renameTodo = useCallback(
        (todo, title) =>
            attempt(
                (lists) => withTodoChanged(lists, todo, { title }),
                () => todoService.updateTodo(todo._id, { title }),
            ),
        [attempt],
    );

    const moveTodo = useCallback(
        (todo, listId) =>
            attempt(
                (lists) => withTodoChanged(lists, todo, { list: listId }),
                () => todoService.updateTodo(todo._id, { listId }),
            ),
        [attempt],
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
                (lists) => withoutTodos(lists, [todo._id]),
                () => todoService.deleteTodo(todo._id),
                { words: NOT_DELETED_WORDS, retry: () => latest.current.deleteTodo(todo) },
            );
            if (!sent) return false;

            toast(todoGoneWords(todo), {
                id: `todo-deleted-${todo._id}`,
                action: { label: "Undo", onClick: () => bringBack("todo", [todo._id]) },
            });
            return true;
        },
        [attempt, bringBack],
    );

    // Moves a list's finished to-dos to Trash
    const clearDone = useCallback(
        async (list) => {
            const finished = list.todos.filter((todo) => todo.done).map((todo) => todo._id);
            if (finished.length === 0) return;

            const sent = await attempt(
                (lists) => withoutTodos(lists, finished),
                () => todoService.clearDone(list._id),
                { words: NOT_DELETED_WORDS },
            );
            if (!sent) return;

            toast(clearedWords(sent.ids.length), {
                id: `todo-cleared-${list._id}`,
                action: { label: "Undo", onClick: () => bringBack("todo", sent.ids) },
            });
        },
        [attempt, bringBack],
    );

    // Makes a named list. Resolves with it as saved; rejects with the server's reason.
    const addList = useCallback(
        async (name) => {
            const list = await todoService.createList(name);

            change((lists) => withList(lists, list));
            return list;
        },
        [change],
    );

    // Renames one. Resolves with it as saved; rejects with the server's reason.
    const renameList = useCallback(
        async (list, name) => {
            const saved = await todoService.renameList(list._id, name);

            change((lists) => withList(lists, { _id: saved._id, name: saved.name }));
            return saved;
        },
        [change],
    );

    const deleteList = useCallback(
        async (list) => {
            const sent = await attempt(
                (lists) => withoutList(lists, list._id),
                () => todoService.deleteList(list._id),
                { words: NOT_DELETED_WORDS },
            );
            if (!sent) return false;

            const words = listGoneWords(list, sent.todos ?? 0);
            toast(words.message, {
                id: `todo-list-deleted-${list._id}`,
                detail: words.detail,
                action: { label: "Undo", onClick: () => bringBack("todoList", [list._id]) },
            });
            return true;
        },
        [attempt, bringBack],
    );

    useEffect(() => {
        latest.current = { state, setDone, deleteTodo };
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
            deleteTodo,
            clearDone,
            addList,
            renameList,
            deleteList,
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
            deleteTodo,
            clearDone,
            addList,
            renameList,
            deleteList,
        ],
    );

    return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};

export { TodoContext };
