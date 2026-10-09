import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../hooks/useAuth";
import useToday from "../hooks/useToday";
import {
    deletedWords,
    notDeletedWords,
    notReorderedWords,
    notRestoredWords,
    trashedDetail,
} from "../lib/itemWords";
import { toast } from "../lib/toast";
import habitService from "../services/habitService";
import routineService from "../services/routineService";

/*
 * The plan: every routine, whatever day it falls on, and the making, changing and deleting of routines
 * and habits alike.
 *
 * The habits themselves are not kept here. Today already holds every habit (the API lists them all,
 * due or not), so there is one copy of them, in TodayContext, and this context tells it what changed.
 * Routines are different: Today holds only the ones that fall on today, so the whole list lives here.
 *
 * Making and changing wait for the server: the form shows that it is working, and what comes back is
 * what is shown. Deleting does not wait. The item leaves for Trash at once, and a toast offers to bring
 * it back. The XP it earned goes with it and comes back with it, so the level is read again both times.
 */

const EMPTY = {
    status: "idle", // "idle" until first asked for, then "loading", then "ready" or "error"
    routines: [],
    error: null,
};

const PlanContext = createContext(null);

const services = {
    routine: {
        create: async (data) => routineService.createRoutine(data),
        update: async (id, data) => routineService.updateRoutine(id, data),
        remove: (id) => routineService.deleteRoutine(id),
        restore: async (id) => routineService.restoreRoutine(id),
    },
    habit: {
        create: async (data) => (await habitService.createHabit(data)).habit,
        update: async (id, data) => (await habitService.updateHabit(id, data)).habit,
        remove: (id) => habitService.deleteHabit(id),
        restore: async (id) => (await habitService.restoreHabit(id)).habit,
    },
};

export const PlanProvider = ({ children }) => {
    const { isAuthenticated, user, fetchGamificationStats } = useAuth();
    const today = useToday();

    const [state, setState] = useState(EMPTY);
    // The item made most recently, so the screen it lands on can mark its arrival: { key, at }
    const [arrived, setArrived] = useState(null);

    const latest = useRef({ state: EMPTY, today });
    const loading = useRef(false);
    const ticket = useRef(0);
    // Goes up with every change made here. A list requested before a change may not replace what is shown.
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
            const { routines } = await routineService.getAllRoutines();
            if (mine !== ticket.current) return;
            if (changesAtStart !== changes.current) {
                load({ quiet: true });
                return;
            }

            setState({ status: "ready", routines: routines ?? [], error: null });
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

    // Called by a screen that shows the plan: loads it the first time, and refreshes it quietly after that
    const ensure = useCallback(() => {
        latest.current.today.ensure();
        if (loading.current) return;

        load({ quiet: latest.current.state.status === "ready" });
    }, [load]);

    const retry = useCallback(() => {
        latest.current.today.retry();
        load();
    }, [load]);

    // Puts an item into the lists as the server now holds it, here and on Today
    const show = useCallback((kind, item) => {
        changes.current += 1;

        if (kind === "routine") {
            setState((current) => ({
                ...current,
                routines: current.routines.some((entry) => entry._id === item._id)
                    ? current.routines.map((entry) => (entry._id === item._id ? item : entry))
                    : [...current.routines, item],
            }));
        }
        latest.current.today.putItem(kind, item);
    }, []);

    const hide = useCallback((kind, id) => {
        changes.current += 1;

        if (kind === "routine") {
            setState((current) => ({
                ...current,
                routines: current.routines.filter((entry) => entry._id !== id),
            }));
        }
        latest.current.today.dropItem(kind, id);
    }, []);

    /**
     * Makes a routine or a habit. Resolves with it as saved; rejects with the server's reason.
     * @param {String} kind - "routine" or "habit"
     * @param {Object} data - from payloadOf (lib/itemForm.js)
     */
    const createItem = useCallback(
        async (kind, data) => {
            const item = await services[kind].create(data);

            show(kind, item);
            setArrived({ key: `${kind}:${item._id}`, at: Date.now() });
            return item;
        },
        [show],
    );

    // Changes one. Resolves with it as saved; rejects with the server's reason.
    const updateItem = useCallback(
        async (kind, id, data) => {
            const item = await services[kind].update(id, data);

            show(kind, item);
            return item;
        },
        [show],
    );

    // Brings back something that was deleted
    const restoreItem = useCallback(
        async (kind, item) => {
            try {
                const restored = await services[kind].restore(item._id);

                show(kind, restored);
                // What it had logged today comes back with it, and so does its XP: only the server knows either
                latest.current.today.refresh();
                latest.current.fetchGamificationStats?.().catch(() => {});
            } catch {
                toast.error(notRestoredWords(item.title), {
                    id: `plan-restore-${item._id}`,
                    action: { label: "Try again", onClick: () => latest.current.restoreItem(kind, item) },
                });
            }
        },
        [show],
    );

    /**
     * Deletes one. It leaves the lists at once; a toast then offers to bring it back.
     * @param {Object} item - as the API sent it
     * @returns {Promise<Boolean>} - whether it was deleted
     */
    const deleteItem = useCallback(
        async (kind, item) => {
            // What Today is showing for it, so that a delete that fails can put that back too
            const lists = kind === "routine" ? latest.current.today.routines : latest.current.today.habits;
            const shown = lists.find((entry) => entry._id === item._id) ?? item;

            hide(kind, item._id);

            let answer;
            try {
                answer = await services[kind].remove(item._id);
            } catch {
                show(kind, shown);
                toast.error(notDeletedWords(item.title), {
                    id: `plan-delete-${item._id}`,
                    action: { label: "Try again", onClick: () => latest.current.deleteItem(kind, item) },
                });
                return false;
            }

            toast(deletedWords(item.title), {
                id: `plan-deleted-${item._id}`,
                detail: trashedDetail(answer),
                action: { label: "Undo", onClick: () => latest.current.restoreItem(kind, shown) },
            });
            // Its XP left with it, and the day's bonus and what today still owes may have moved
            latest.current.today.refresh();
            latest.current.fetchGamificationStats?.().catch(() => {});
            return true;
        },
        [hide, show],
    );

    /**
     * Puts habits in a new order.
     * @param {Array} ids - the ids of the habits of one part of the day, in the order they should now run
     */
    const reorderHabits = useCallback(async (ids) => {
        const { today: day } = latest.current;
        const before = new Map(day.habits.map((habit) => [habit._id, habit.order ?? 0]));
        const orders = new Map(ids.map((id, index) => [id, index]));

        day.orderHabits(orders);

        try {
            await habitService.reorderHabits({
                habits: ids.map((id, index) => ({ id, order: index })),
            });
        } catch {
            day.orderHabits(new Map(ids.map((id) => [id, before.get(id) ?? 0])));
            toast.error(notReorderedWords, {
                id: "plan-reorder",
                action: { label: "Try again", onClick: () => latest.current.reorderHabits(ids) },
            });
        }
    }, []);

    useEffect(() => {
        latest.current = { state, today, restoreItem, deleteItem, reorderHabits, fetchGamificationStats };
    });

    // Signing out, or signing in as someone else, starts from nothing
    const userId = isAuthenticated ? (user?._id ?? user?.id ?? user?.email ?? "") : null;
    useEffect(
        () => () => {
            ticket.current += 1;
            loading.current = false;
            setState(EMPTY);
            setArrived(null);
        },
        [userId],
    );

    const value = useMemo(
        () => ({
            ...state,
            arrived,
            ensure,
            retry,
            createItem,
            updateItem,
            deleteItem,
            reorderHabits,
        }),
        [state, arrived, ensure, retry, createItem, updateItem, deleteItem, reorderHabits],
    );

    return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export { PlanContext };
