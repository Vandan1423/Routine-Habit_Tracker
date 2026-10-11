import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../hooks/useAuth";
import useToday from "../hooks/useToday";
import { localDay } from "../lib/dates";
import { adoptDraft, newDraftId } from "../lib/drafts";
import { draftItem } from "../lib/itemForm";
import {
    broughtBackWords,
    deletedWords,
    notBroughtBackWords,
    notDeletedWords,
    notPausedWords,
    notReorderedWords,
    notRestoredWords,
    notResumedWords,
    notRetiredWords,
    pausedWords,
    resumedWords,
    retiredDetail,
    retiredWords,
    trashedDetail,
} from "../lib/itemWords";
import { endPausesFrom, pauseAhead, withPause } from "../lib/pauses";
import { toast } from "../lib/toast";
import habitService from "../services/habitService";
import { newKey } from "../services/outbox";
import routineService from "../services/routineService";

/*
 * The plan: every routine, whatever day it falls on, and the making, changing and deleting of routines
 * and habits alike.
 *
 * The habits themselves are not kept here. Today already holds every habit (the API lists them all,
 * due or not), so there is one copy of them, in TodayContext, and this context tells it what changed.
 * Routines are different: Today holds only the ones that fall on today, so the whole list lives here.
 *
 * Nothing here waits for the server. A new item is in the plan (and on today, if it falls on today) the
 * moment its form is sent, as the form gave it; it takes the server's id when that arrives, and until
 * then nothing on its row can be pressed. A changed one is shown as changed at once. If the server
 * refuses, the item is taken out, or put back as it was, and whoever asked is told why. A deleted item
 * leaves for Trash at once, and a toast offers to bring it back. The XP it earned stays; only one deleted
 * under the older rule has XP held back, and recovering it pays that back, so the level is read again then.
 *
 * Retiring is deleting's gentler twin: the item leaves for Archive, where it is kept for good with its history,
 * and can be brought back from there. Pausing keeps it in the plan but off the days chosen.
 */

const EMPTY = {
    status: "idle", // "idle" until first asked for, then "loading", then "ready" or "error"
    routines: [],
    error: null,
};

const PlanContext = createContext(null);

// An item as it is on screen now: as Today shows it where it is on today (that carries what it has logged)
const shownIn = ({ state: plan, today: day }, kind, item) =>
    (kind === "routine" ? day.routines : day.habits).find((entry) => entry._id === item._id) ??
    (kind === "routine" ? plan.routines.find((entry) => entry._id === item._id) : null) ??
    item;

const services = {
    routine: {
        create: async (data, key) => routineService.createRoutine(data, key),
        update: async (id, data) => routineService.updateRoutine(id, data),
        remove: (id) => routineService.deleteRoutine(id),
        restore: async (id) => routineService.restoreRoutine(id),
        archive: (id) => routineService.archiveRoutine(id),
        unarchive: async (id) => routineService.unarchiveRoutine(id),
        pause: async (id, data) => routineService.pauseRoutine(id, data),
        resume: async (id) => routineService.resumeRoutine(id),
    },
    habit: {
        create: async (data, key) => (await habitService.createHabit(data, key)).habit,
        update: async (id, data) => (await habitService.updateHabit(id, data)).habit,
        remove: (id) => habitService.deleteHabit(id),
        restore: async (id) => (await habitService.restoreHabit(id)).habit,
        archive: (id) => habitService.archiveHabit(id),
        unarchive: async (id) => (await habitService.unarchiveHabit(id)).habit,
        pause: async (id, data) => (await habitService.pauseHabit(id, data)).habit,
        resume: async (id) => (await habitService.resumeHabit(id)).habit,
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
     * Makes a routine or a habit. It is shown at once. Resolves with it as saved; rejects with the
     * server's reason once it has been taken out again.
     * @param {String} kind - "routine" or "habit"
     * @param {Object} data - from payloadOf (lib/itemForm.js)
     * @param {String} [key] - the key it was sent under before, when this is a second try
     */
    const createItem = useCallback(
        (kind, data, key = newKey()) => {
            const draft = draftItem(kind, data, { id: newDraftId(kind), habits: latest.current.today.habits });

            show(kind, draft);
            setArrived({ key: `${kind}:${draft._id}`, at: Date.now() });

            return services[kind].create(data, key).then(
                (item) => {
                    // The row it was drawn in stays where it is: only what it stands for changes
                    adoptDraft(draft._id, item._id);
                    hide(kind, draft._id);
                    show(kind, item);
                    return item;
                },
                (error) => {
                    hide(kind, draft._id);
                    throw error;
                },
            );
        },
        [show, hide],
    );

    // Changes one. It is shown as changed at once. Resolves with it as saved; rejects with the server's
    // reason once it has been put back as it was.
    const updateItem = useCallback(
        (kind, id, data) => {
            const { state: plan, today: day } = latest.current;
            // As Today shows it, where it is on today: that carries what it has logged
            const before =
                (kind === "routine" ? day.routines : day.habits).find((entry) => entry._id === id) ??
                (kind === "routine" ? plan.routines.find((entry) => entry._id === id) : null);

            if (before) show(kind, draftItem(kind, data, { existing: before }));

            return services[kind].update(id, data).then(
                (item) => {
                    show(kind, item);
                    return item;
                },
                (error) => {
                    if (before) show(kind, before);
                    throw error;
                },
            );
        },
        [show],
    );

    // Brings back something that was deleted
    const restoreItem = useCallback(
        async (kind, item) => {
            try {
                const restored = await services[kind].restore(item._id);

                // One deleted from Archive went back there, not into the plan
                if (restored.isActive !== false) show(kind, restored);
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
     * Brings a retired item back from Archive into the plan.
     * @returns {Promise<Object|null>} - the item as it now is, or null if it didn't come back
     */
    const bringBackItem = useCallback(
        async (kind, item) => {
            let back;
            try {
                back = await services[kind].unarchive(item._id);
            } catch (error) {
                toast.error(notBroughtBackWords(item.title), {
                    id: `plan-unarchive-${item._id}`,
                    detail: error?.cause?.response ? error.message : undefined,
                    action: { label: "Try again", onClick: () => latest.current.bringBackItem(kind, item) },
                });
                return null;
            }

            show(kind, back);
            toast(broughtBackWords(item.title), { id: `plan-unarchived-${item._id}` });
            // What it had logged today comes back with it; only the server knows that
            latest.current.today.refresh();
            return back;
        },
        [show],
    );

    /**
     * Retires one: it leaves the lists for Archive at once; a toast then offers to bring it back.
     * @returns {Promise<Boolean>} - whether it was retired
     */
    const retireItem = useCallback(
        async (kind, item) => {
            const shown = shownIn(latest.current, kind, item);
            hide(kind, item._id);

            let answer;
            try {
                answer = await services[kind].archive(item._id);
            } catch (error) {
                show(kind, shown);
                toast.error(notRetiredWords(item.title), {
                    id: `plan-archive-${item._id}`,
                    detail: error?.cause?.response ? error.message : undefined,
                    action: { label: "Try again", onClick: () => latest.current.retireItem(kind, item) },
                });
                return false;
            }

            toast(retiredWords(item.title), {
                id: `plan-archived-${item._id}`,
                detail: retiredDetail(answer),
                action: { label: "Undo", onClick: () => latest.current.bringBackItem(kind, shown) },
            });
            // The day's bonus and what today still owes may have moved
            latest.current.today.refresh();
            return true;
        },
        [hide, show],
    );

    /**
     * Pauses one for a number of days. It is shown paused at once (off today, if the pause covers today).
     * @param {Object} span - { from: "YYYY-MM-DD", days }
     * @returns {Promise<Boolean>} - whether it was paused
     */
    const pauseItem = useCallback(
        async (kind, item, { from, days }) => {
            const date = latest.current.today.date ?? localDay();
            const before = shownIn(latest.current, kind, item);
            // Undoing is resuming only when nothing else was paused from today on
            const hadPause = Boolean(pauseAhead(before, date));

            show(kind, { ...before, pauses: withPause(before.pauses, { from, days }, date) });

            let saved;
            try {
                saved = await services[kind].pause(item._id, { from, days });
            } catch (error) {
                show(kind, before);
                toast.error(notPausedWords(item.title), {
                    id: `plan-pause-${item._id}`,
                    detail: error?.cause?.response ? error.message : undefined,
                    action: { label: "Try again", onClick: () => latest.current.pauseItem(kind, item, { from, days }) },
                });
                return false;
            }

            show(kind, saved);
            toast(pausedWords(item.title, pauseAhead(saved, date) ?? { from, until: from }, date), {
                id: `plan-paused-${item._id}`,
                action: hadPause
                    ? undefined
                    : { label: "Undo", onClick: () => latest.current.resumeItem(kind, saved, { quiet: true }) },
            });
            latest.current.today.refresh();
            return true;
        },
        [show],
    );

    /**
     * Ends a pause early: due again from today.
     * @param {Object} [options] - quiet: say nothing once it is done (it undoes a pause just set)
     */
    const resumeItem = useCallback(
        async (kind, item, { quiet = false } = {}) => {
            const date = latest.current.today.date ?? localDay();
            const before = shownIn(latest.current, kind, item);

            show(kind, { ...before, pauses: endPausesFrom(before.pauses, date) });

            let saved;
            try {
                saved = await services[kind].resume(item._id);
            } catch {
                show(kind, before);
                toast.error(notResumedWords(item.title), {
                    id: `plan-resume-${item._id}`,
                    action: { label: "Try again", onClick: () => latest.current.resumeItem(kind, item) },
                });
                return false;
            }

            show(kind, saved);
            if (!quiet) toast(resumedWords(item.title), { id: `plan-resumed-${item._id}` });
            // What it had logged today, if it had been done before it was paused, comes back with it
            latest.current.today.refresh();
            return true;
        },
        [show],
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
        latest.current = {
            state,
            today,
            restoreItem,
            deleteItem,
            reorderHabits,
            retireItem,
            bringBackItem,
            pauseItem,
            resumeItem,
            fetchGamificationStats,
        };
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
            retireItem,
            bringBackItem,
            pauseItem,
            resumeItem,
        }),
        [
            state,
            arrived,
            ensure,
            retry,
            createItem,
            updateItem,
            deleteItem,
            reorderHabits,
            retireItem,
            bringBackItem,
            pauseItem,
            resumeItem,
        ],
    );

    return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export { PlanContext };
