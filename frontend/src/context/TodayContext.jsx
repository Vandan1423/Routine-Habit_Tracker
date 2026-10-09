import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAuth from "../hooks/useAuth";
import { addDays, localDay } from "../lib/dates";
import { expectedRoutineLog, firstRoutineOf, stepQuantity } from "../lib/day";
import { isDueOn } from "../lib/plan";
import { toast } from "../lib/toast";
import habitService from "../services/habitService";
import routineService from "../services/routineService";
import streakService from "../services/streakService";

/*
 * Today's data, and the changes made to it.
 *
 * It holds the two lists as the API sends them (today's routines, and every habit) plus the week and
 * the streak; lib/day.js turns the lists into the day that is drawn. Loading starts when a screen first
 * asks (ensure), and what was loaded stays for the session, so coming back to Today shows it at once
 * while a fresh copy is fetched behind it.
 *
 * A change (a tick, a count, a move) is shown at once and sent after. Each item sends one request at a
 * time: if it is changed again while one is on its way, only the latest state is sent next. A request
 * that fails puts the item back as the server last confirmed it and says so in a toast.
 *
 * `pending` names the items whose latest change the server has not answered yet, so a screen can hold
 * back anything that marks an occasion until it has. What follows from a change once it is accepted
 * (something completed, a level reached, the run of days growing) is told to whoever has subscribed.
 *
 * Making, changing and deleting the items themselves is PlanContext's work. It tells this one through
 * putItem, dropItem and orderHabits, so that today's lists follow without being fetched again.
 */

const EMPTY = {
    status: "idle", // "idle" until first asked for, then "loading", then "ready" or "error"
    date: null, // the day the lists are for, "YYYY-MM-DD"
    routines: [],
    habits: [],
    week: [], // the most recent daily summaries, newest first
    streak: null, // { current, best }
    bonus: 0, // the XP today holds for having everything done
    owed: [], // what was deleted today while still due: [{ kind, id, title, xp }], charged tonight unless recovered and done
    recap: [], // the days that ended recently, with what each one cost (see lib/recap.js)
    tomorrow: undefined, // what tomorrow starts with: not asked yet, null for nothing, or { title, start }
    error: null,
};

const NOTHING_PENDING = new Set();

// The level, the week and the streak are fetched again once the last change has landed. Changes that land
// together are answered by one fetch.
const AFTERMATH_DELAY = 60;
// Coming back to the tab fetches a fresh copy if the one on screen is at least this old
const STALE_AFTER = 60 * 1000;

const TodayContext = createContext(null);

const keyOf = (kind, id) => `${kind}:${id}`;
const splitKey = (key) => key.split(":");

const findIn = (state, kind, id) =>
    (kind === "routine" ? state.routines : state.habits).find((item) => item._id === id);

// Whether a log, as the server holds it, means the item is done
const isDone = (kind, todayLog) => (kind === "routine" ? Boolean(todayLog) : Boolean(todayLog?.completed));

// The value that, sent as a change, would bring an item back to how a log shows it
const valueOf = (kind, item, todayLog) => {
    if (kind === "routine") return Boolean(todayLog);
    if (item?.habitType === "quantity") return todayLog?.quantity ?? 0;
    return todayLog?.completed ? 1 : 0;
};

// The server answered, and its answer is that things are not as this screen thought
// (already done, already undone, deleted, a new day): not a failure to report, a reason to look again
const isDisagreement = (error) => {
    const status = error?.cause?.response?.status;
    return status === 400 || status === 404 || status === 409;
};

export const TodayProvider = ({ children }) => {
    const { isAuthenticated, user, levelInfo, levelLoaded, fetchGamificationStats } = useAuth();

    const [state, setState] = useState(EMPTY);
    const [pending, setPending] = useState(NOTHING_PENDING);

    // The latest of everything the callbacks below read, so that they never go stale themselves.
    // Filled in after each render, further down.
    const latest = useRef({ state: EMPTY });

    // What has been asked for and not yet confirmed, by item: the value wanted, the log the server last
    // confirmed (to go back to), and which items have a request on its way
    const wanted = useRef(new Map());
    const confirmed = useRef(new Map());
    const sending = useRef(new Set());
    // Goes up with every change. A list that was requested before a change may not replace what is shown.
    const changes = useRef(0);
    const loadTicket = useRef(0);
    const loadedAt = useRef(0);
    const loading = useRef(false);
    const reloadWanted = useRef(false);
    const aftermathTimer = useRef(null);
    // The day by this device's clock when the lists were last loaded, and when the recap was
    const loadedOn = useRef(null);
    const recapFor = useRef(null);
    const tomorrowAsked = useRef(null);
    // The level and the run of days as they stood before the changes now on their way
    const baseline = useRef(null);
    // Goes up when the account changes: an answer that arrives for the one before is dropped
    const session = useRef(0);
    const listeners = useRef(new Set());

    // subscribe(listener) is told what follows from a change once the server has accepted it:
    //   { type: "changed", key }                              an item was changed here, just now
    //   { type: "completed", key, title, earned, late, undo } it went from open to done
    //   { type: "level", level }                              a level was reached
    //   { type: "streak", days, best, bonus }                 the run of days grew; best is what it stood at before
    //   { type: "day", date }                                 the day on screen gave way to the next
    // It answers with the function that ends the subscription.
    const subscribe = useCallback((listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
    }, []);
    const emit = useCallback((event) => {
        listeners.current.forEach((listener) => listener(event));
    }, []);

    const showPending = useCallback(() => {
        setPending(wanted.current.size > 0 ? new Set(wanted.current.keys()) : NOTHING_PENDING);
    }, []);

    const patchItem = useCallback((kind, id, patch) => {
        const list = kind === "routine" ? "routines" : "habits";

        setState((current) => ({
            ...current,
            [list]: current[list].map((item) =>
                item._id === id ? { ...item, ...patch(item) } : item,
            ),
        }));
    }, []);

    const load = useCallback(async ({ quiet = false } = {}) => {
        // Never while a change is on its way: the answer could predate it. It runs once they have all landed.
        if (sending.current.size > 0) {
            reloadWanted.current = true;
            return;
        }

        const ticket = ++loadTicket.current;
        const changesAtStart = changes.current;
        const deviceDay = localDay();
        // The recap only changes when a day ends
        const wantRecap = recapFor.current !== deviceDay;
        reloadWanted.current = false;
        loading.current = true;

        if (!quiet) {
            setState((current) =>
                current.status === "ready" ? current : { ...current, status: "loading", error: null },
            );
        }

        try {
            const [routines, habits, streak, recap] = await Promise.all([
                routineService.getRoutines(),
                habitService.getHabits(),
                streakService.getInfo(), // answers null rather than failing: the week and streak are extras
                wantRecap ? streakService.getRecap() : null, // and so does this
            ]);

            if (ticket !== loadTicket.current) return;
            if (changesAtStart !== changes.current) {
                reloadWanted.current = true;
                if (sending.current.size === 0) load({ quiet: true });
                return;
            }

            const date = habits.today ?? deviceDay;
            const previous = latest.current.state.date;

            loadedAt.current = Date.now();
            loadedOn.current = deviceDay;
            if (recap) recapFor.current = deviceDay;

            setState((current) => ({
                status: "ready",
                date,
                routines: routines.routines ?? [],
                habits: habits.habits ?? [],
                week: streak?.recentLogs ?? current.week,
                streak: streak
                    ? { current: streak.currentStreak, best: streak.bestStreak }
                    : current.streak,
                bonus: streak ? (streak.todayBonus ?? 0) : current.bonus,
                owed: streak ? (streak.owed ?? []) : current.owed,
                recap: recap?.days ?? current.recap,
                tomorrow: current.date === date ? current.tomorrow : undefined,
                error: null,
            }));

            if (previous && previous !== date) emit({ type: "day", date });
        } catch (error) {
            if (ticket !== loadTicket.current) return;

            // A refresh behind the scenes that fails leaves what is on screen alone
            setState((current) =>
                current.status === "ready" ? current : { ...current, status: "error", error },
            );
        } finally {
            if (ticket === loadTicket.current) loading.current = false;
        }
    }, [emit]);

    // A request has come back. Once none is left on its way, a refresh that was held back may run.
    const landed = useCallback(
        (key) => {
            sending.current.delete(key);

            if (sending.current.size === 0 && reloadWanted.current) {
                load({ quiet: true });
            }
        },
        [load],
    );

    // Called by a screen that shows today: loads it the first time, and refreshes it quietly after that
    const ensure = useCallback(() => {
        if (loading.current) return;

        load({ quiet: latest.current.state.status === "ready" });
    }, [load]);

    // After a change has landed: the level, the week, the streak and the day's bonus may all have moved
    const scheduleAftermath = useCallback(() => {
        clearTimeout(aftermathTimer.current);
        aftermathTimer.current = setTimeout(async () => {
            // Not while another change is on its way: its own landing comes back here
            if (!latest.current.signedIn || sending.current.size > 0) return;

            const ticket = loadTicket.current;
            const account = session.current;
            const before = baseline.current;
            baseline.current = null;

            const [stats, streak] = await Promise.all([
                latest.current.fetchGamificationStats?.(),
                streakService.getInfo(),
            ]);
            if (account !== session.current) return;

            // A full load that started meanwhile brings the same numbers, later
            if (streak && ticket === loadTicket.current) {
                setState((current) => ({
                    ...current,
                    week: streak.recentLogs ?? current.week,
                    streak: { current: streak.currentStreak, best: streak.bestStreak },
                    bonus: streak.todayBonus ?? 0,
                    owed: streak.owed ?? [],
                }));
            }

            if (!before) return;
            if (stats && before.level !== null && stats.level > before.level) {
                emit({ type: "level", level: stats.level });
            }
            if (streak && before.streak !== null && streak.currentStreak > before.streak) {
                emit({
                    type: "streak",
                    days: streak.currentStreak,
                    best: before.best ?? 0,
                    bonus: streak.todayBonus ?? 0,
                });
            }
        }, AFTERMATH_DELAY);
    }, [emit]);

    // How an item looks from the moment it is changed until the server has answered
    const showWanted = useCallback(
        (kind, id, value) => {
            if (kind === "routine") {
                patchItem(kind, id, (routine) => ({
                    todayLog: value ? expectedRoutineLog(routine) : null,
                }));
                return;
            }

            patchItem(kind, id, (habit) => {
                if (value <= 0) return { todayLog: null };

                const counted = habit.habitType === "quantity";
                const completed = !counted || value >= habit.targetQuantity;

                return {
                    todayLog: {
                        ...habit.todayLog,
                        quantity: counted ? value : habit.targetQuantity,
                        completed,
                        xpEarned: completed ? (habit.todayLog?.xpEarned ?? habit.xpReward) : undefined,
                    },
                };
            });
        },
        [patchItem],
    );

    // Sends one item's wanted state, and returns what the server then holds for it.
    // A routine is sent with the day this screen is showing: if that day has ended, the server refuses.
    const send = async (kind, id, value) => {
        if (kind === "routine") {
            const date = latest.current.state.date ?? undefined;

            if (!value) {
                await routineService.uncompleteRoutine(id, date);
                return { todayLog: null };
            }
            const { log } = await routineService.completeRoutine(id, date);
            return { todayLog: log };
        }

        const { habit, log } = await habitService.setHabitLog(id, value);
        // The habit comes back with its streak and totals brought up to date
        return { ...habit, todayLog: log ?? null };
    };

    const sync = useCallback(
        async (key) => {
            if (sending.current.has(key)) return;
            sending.current.add(key);

            const [kind, id] = splitKey(key);

            try {
                while (wanted.current.has(key)) {
                    const value = wanted.current.get(key);
                    const before = confirmed.current.get(key);
                    const held = await send(kind, id, value);

                    confirmed.current.set(key, held);

                    // Unless it was changed again meanwhile, what the server holds is what is shown
                    if (wanted.current.get(key) === value) {
                        wanted.current.delete(key);
                        patchItem(kind, id, () => held);
                        showPending();

                        if (!isDone(kind, before?.todayLog) && isDone(kind, held.todayLog)) {
                            const item = findIn(latest.current.state, kind, id);
                            const back = valueOf(kind, item, before?.todayLog);

                            emit({
                                type: "completed",
                                key,
                                title: item?.title ?? "",
                                earned: held.todayLog.xpEarned ?? 0,
                                late: kind === "routine" && held.todayLog.wasOnTime === false,
                                undo: () => latest.current.change(kind, id, back),
                            });
                        }
                    }
                }
            } catch (error) {
                const value = wanted.current.get(key);
                const back = confirmed.current.get(key);
                wanted.current.delete(key);
                if (back) patchItem(kind, id, () => back);
                showPending();

                if (isDisagreement(error)) {
                    reloadWanted.current = true;
                } else if (value !== undefined) {
                    const title = findIn(latest.current.state, kind, id)?.title;
                    toast.error(title ? `“${title}” didn’t save.` : "That didn’t save.", {
                        id: `today-save-${key}`,
                        action: {
                            label: "Try again",
                            onClick: () => latest.current.change(kind, id, value),
                        },
                    });
                }
            } finally {
                confirmed.current.delete(key);
                landed(key);
                scheduleAftermath();
            }
        },
        [patchItem, scheduleAftermath, landed, showPending, emit],
    );

    const change = useCallback(
        (kind, id, value) => {
            const item = findIn(latest.current.state, kind, id);
            if (!item) return;

            // Midnight has gone by since this list was loaded: it is yesterday's now, and closed.
            // Fetch today instead of sending a change meant for a day that has ended.
            if (loadedOn.current && localDay() !== loadedOn.current) {
                load({ quiet: true });
                return;
            }

            const key = keyOf(kind, id);
            if (!confirmed.current.has(key)) {
                confirmed.current.set(key, { todayLog: item.todayLog ?? null });
            }
            baseline.current ??= {
                level: latest.current.level,
                streak: latest.current.state.streak?.current ?? null,
                best: latest.current.state.streak?.best ?? null,
            };

            wanted.current.set(key, value);
            changes.current += 1;
            showWanted(kind, id, value);
            showPending();
            emit({ type: "changed", key });
            sync(key);
        },
        [showWanted, showPending, sync, load, emit],
    );

    // Tick or un-tick a routine
    const setRoutineDone = useCallback((id, done) => change("routine", id, Boolean(done)), [change]);

    // Set a habit's count for today: 0 clears it, the target completes it. A yes-or-no habit takes 1 or 0.
    const setHabitQuantity = useCallback(
        (id, quantity) => change("habit", id, Math.max(Number(quantity) || 0, 0)),
        [change],
    );

    // Step a counted habit up or down from wherever it stands, counting a change that is still on its way
    const stepHabit = useCallback(
        (id, direction) => {
            const habit = findIn(latest.current.state, "habit", id);
            if (!habit) return;

            const key = keyOf("habit", id);
            const target = habit.targetQuantity || 1;
            const from = wanted.current.has(key)
                ? wanted.current.get(key)
                : (habit.todayLog?.quantity ?? 0);

            change("habit", id, stepQuantity(Math.min(from, target), target, direction));
        },
        [change],
    );

    // Move a habit to another part of the day
    const moveHabit = useCallback(
        async (id, timeOfDay) => {
            const habit = findIn(latest.current.state, "habit", id);
            const from = habit?.timeOfDay ?? "anytime";
            if (!habit || from === timeOfDay) return;

            const key = keyOf("move", id);
            sending.current.add(key);
            changes.current += 1;
            patchItem("habit", id, () => ({ timeOfDay }));

            try {
                const { habit: saved } = await habitService.updateHabit(id, { timeOfDay });
                // It lands after the habits already there, and the server says where that is
                if (saved?.order !== undefined) patchItem("habit", id, () => ({ order: saved.order }));
            } catch {
                patchItem("habit", id, () => ({ timeOfDay: from }));
                toast.error(`“${habit.title}” didn’t move.`, {
                    id: `today-move-${id}`,
                    action: {
                        label: "Try again",
                        onClick: () => latest.current.moveHabit(id, timeOfDay),
                    },
                });
            } finally {
                landed(key);
            }
        },
        [patchItem, landed],
    );

    // Fetches a fresh copy behind what is on screen
    const refresh = useCallback(() => load({ quiet: true }), [load]);

    // What tomorrow starts with, asked for once the day on screen is finished
    const ensureTomorrow = useCallback(async () => {
        const { date, tomorrow } = latest.current.state;
        if (!date || tomorrow !== undefined || tomorrowAsked.current === date) return;

        tomorrowAsked.current = date;
        const account = session.current;

        try {
            const { routines } = await routineService.getRoutines(addDays(date, 1));
            if (account !== session.current) return;

            setState((current) =>
                current.date === date ? { ...current, tomorrow: firstRoutineOf(routines) } : current,
            );
        } catch {
            // Said only if it is known; a later look may ask again
            tomorrowAsked.current = null;
        }
    }, []);

    // An item was made, changed or brought back: show it here as it now is.
    // Every habit is listed, due today or not; a routine only if it falls on the day on screen.
    const putItem = useCallback((kind, item) => {
        changes.current += 1;

        setState((current) => {
            if (current.status !== "ready") return current;

            const list = kind === "routine" ? "routines" : "habits";
            const existing = current[list].find((entry) => entry._id === item._id);
            const belongs = kind === "habit" || isDueOn("routine", item, current.date);

            if (!belongs) {
                return existing
                    ? { ...current, [list]: current[list].filter((entry) => entry._id !== item._id) }
                    : current;
            }

            const shown = {
                ...existing,
                ...item,
                todayLog: existing?.todayLog ?? item.todayLog ?? null,
                ...(kind === "habit" ? { dueToday: isDueOn("habit", item, current.date) } : null),
            };

            return {
                ...current,
                [list]: existing
                    ? current[list].map((entry) => (entry._id === item._id ? shown : entry))
                    : [...current[list], shown],
            };
        });
    }, []);

    // An item was deleted
    const dropItem = useCallback((kind, id) => {
        const key = keyOf(kind, id);
        const list = kind === "routine" ? "routines" : "habits";

        changes.current += 1;
        wanted.current.delete(key);
        showPending();
        setState((current) => ({
            ...current,
            [list]: current[list].filter((entry) => entry._id !== id),
        }));
    }, [showPending]);

    // Habits were put in a new order: each takes the place its id has on the list
    const orderHabits = useCallback((orders) => {
        changes.current += 1;
        setState((current) => ({
            ...current,
            habits: current.habits.map((habit) =>
                orders.has(habit._id) ? { ...habit, order: orders.get(habit._id) } : habit,
            ),
        }));
    }, []);

    useEffect(() => {
        latest.current = {
            state,
            signedIn: isAuthenticated,
            level: levelLoaded ? levelInfo.level : null,
            change,
            moveHabit,
            fetchGamificationStats,
        };
    });

    // Signing out, or signing in as someone else, starts from nothing
    const userId = isAuthenticated ? (user?._id ?? user?.id ?? user?.email ?? "") : null;
    useEffect(
        () => () => {
            loadTicket.current += 1;
            session.current += 1;
            clearTimeout(aftermathTimer.current);
            wanted.current.clear();
            confirmed.current.clear();
            reloadWanted.current = false;
            loadedAt.current = 0;
            loadedOn.current = null;
            recapFor.current = null;
            tomorrowAsked.current = null;
            baseline.current = null;
            loading.current = false;
            setState(EMPTY);
            setPending(NOTHING_PENDING);
        },
        [userId],
    );

    // Looked at again after a while (the morning's tab, opened in the evening): fetch a fresh copy
    useEffect(() => {
        const onVisible = () => {
            const { status } = latest.current.state;
            const old = Date.now() - loadedAt.current >= STALE_AFTER;

            if (document.visibilityState === "visible" && status === "ready" && old) {
                load({ quiet: true });
            }
        };

        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [load]);

    const value = useMemo(
        () => ({
            ...state,
            pending,
            ensure,
            retry: load,
            refresh,
            ensureTomorrow,
            subscribe,
            setRoutineDone,
            setHabitQuantity,
            stepHabit,
            moveHabit,
            putItem,
            dropItem,
            orderHabits,
        }),
        [
            state,
            pending,
            ensure,
            load,
            refresh,
            ensureTomorrow,
            subscribe,
            setRoutineDone,
            setHabitQuantity,
            stepHabit,
            moveHabit,
            putItem,
            dropItem,
            orderHabits,
        ],
    );

    return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
};

export { TodayContext };
