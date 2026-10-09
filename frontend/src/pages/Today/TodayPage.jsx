import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AmountDialog from "./AmountDialog";
import FirstDay from "./FirstDay";
import RowMenu from "./RowMenu";
import TodayTodos from "./TodayTodos";
import useDayFolds from "./useDayFolds";
import {
    DayBlock,
    DayHeader,
    DayLayout,
    DayProgress,
    DayRecap,
    DaySkeleton,
    DayTotal,
    WeekAside,
} from "../../components/day";
import { ItemEditor, NewItemMenu } from "../../components/plan";
import Page from "../../components/shell/Page";
import { Button, ConfirmDialog, EmptyState, ErrorState } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useLastValue from "../../hooks/useLastValue";
import useListKeys from "../../hooks/useListKeys";
import useNow from "../../hooks/useNow";
import usePlan from "../../hooks/usePlan";
import useRemembered from "../../hooks/useRemembered";
import useSlow from "../../hooks/useSlow";
import useToday from "../../hooks/useToday";
import { addDays, formatDayTitle, localDay } from "../../lib/dates";
import { buildDay, minutesOf, stepQuantity, tallyOf } from "../../lib/day";
import {
    dayMessage,
    greetingAt,
    NEW_DAY_WORDS,
    owedWords,
    reopenWords,
    SAVING_LAST_WORDS,
    tomorrowWords,
} from "../../lib/dayMessage";
import { TRASH_PATH } from "../../lib/places";
import { buildRecap, recapWindow } from "../../lib/recap";
import { KEYS } from "../../lib/shortcuts";
import { addStarters, startersFailedWords } from "../../lib/starters";
import { toast } from "../../lib/toast";
import styles from "./TodayPage.module.css";

// After midnight by this device's clock the new day is asked for at once, and again in case the server's clock is a little behind
const NEW_DAY_RETRIES_MS = [15 * 1000, 60 * 1000];
// A day that changes this soon after midnight changed while the screen was being looked at
const JUST_AFTER_MIDNIGHT_MINUTES = 10;

const NOTHING_REMEMBERED = {};

// Nothing is planned at all, as far as this screen can tell: no habits, nothing today, and no day on record
const looksNew = ({ habits, week }, day) =>
    day.total === 0 &&
    habits.length === 0 &&
    !week.some((summary) => (summary.totalRoutines ?? 0) + (summary.totalHabits ?? 0) > 0);

/**
 * What was moved to Trash today while it was still due. The day's list no longer shows it, but tonight
 * still counts it, so the screen says so plainly and points to where it can be recovered.
 * owed: from useToday()
 */
const OwedNote = ({ owed }) =>
    owed.length > 0 && (
        <p className={styles.owed}>
            {owedWords(owed)}{" "}
            <Link to={TRASH_PATH} className={styles.textLink}>
                Open Trash
            </Link>
        </p>
    );

// Un-ticking this would lose something a second tick cannot bring back: it was done in time, and its time has passed
const reopeningCosts = (item) => item.kind === "routine" && item.done && !item.late && item.overdue;

// A save that has not been answered after this long has the line under the date say that it is waiting
const SAVING_SAID_AFTER_MS = 700;

// Keeps showing the words from before while `hold` is on, and takes up the new ones when it goes off.
// A hold that lasts (a slow save) says so instead, so the old words do not stand beside a count that has moved on.
const useHeldMessage = (message, hold) => {
    const [kept, setKept] = useState(message);
    const same = kept?.lead === message?.lead && kept?.rest === message?.rest;
    const slow = useSlow(hold, SAVING_SAID_AFTER_MS);

    if (!hold && !same) {
        setKept(message);
    }

    if (!hold) return message;
    return slow ? SAVING_LAST_WORDS : kept;
};

/**
 * The day's list and everything said about it, once the day has arrived.
 * Mounted only then, so what it remembers about the day starts from the day as it loaded.
 */
const TodayList = ({
    today,
    day,
    now,
    message,
    recap,
    onDismissRecap,
    memory,
    setMemory,
    onCheck,
    onStep,
    onNew,
    onEdit,
    onSetAmount,
}) => {
    const { date, week, streak, bonus, owed, tomorrow, ensureTomorrow } = today;
    const { isFolded, fold } = useDayFolds(day, date, memory, setMemory);

    // The rows from the keyboard. Ticking and stepping press the row's own controls, so they do exactly what a click does.
    const press = (selector) => (key, row) => {
        const control = row.querySelector(selector);
        if (!control) return false;
        control.click();
        return true;
    };
    const stepUp = press('[data-step="1"]:not(:disabled)');

    useListKeys({
        [KEYS.toggle]: press('input[type="checkbox"]'),
        [KEYS.more]: stepUp,
        // The same key without Shift, which is how "+" is usually reached
        "=": stepUp,
        [KEYS.less]: press('[data-step="-1"]:not(:disabled)'),
        [KEYS.edit]: (key, row) => {
            const item = day.items.find((entry) => entry.key === key);
            // A to-do is reworded in its own row
            if (!item) return press("[data-edit]")(key, row);
            onEdit(item);
            return true;
        },
    });

    // A finished day closes by saying where the next one starts
    useEffect(() => {
        if (day.sealed) ensureTomorrow();
    }, [day.sealed, ensureTomorrow]);

    return (
        <DayLayout
            aside={
                <WeekAside
                    date={date}
                    summaries={week}
                    today={{ total: day.total, done: day.done }}
                    streak={streak}
                />
            }
        >
            <DayHeader
                eyebrow={greetingAt(now)}
                title={formatDayTitle(date)}
                action={<NewItemMenu onNew={onNew} />}
            />
            <DayRecap recap={recap} onDismiss={onDismissRecap} />
            <DayProgress message={message} done={day.done} total={day.total} blocks={day.blocks} />
            {day.blocks.map((block) => (
                <DayBlock
                    key={block.id}
                    block={block}
                    next={day.next}
                    now={now}
                    folded={isFolded(block)}
                    onFold={fold}
                    onCheck={onCheck}
                    onStep={onStep}
                    renderMenu={(item) => (
                        <RowMenu item={item} onEdit={onEdit} onSetAmount={onSetAmount} />
                    )}
                />
            ))}
            <OwedNote owed={owed} />
            <DayTotal
                earned={day.earned}
                bonus={bonus}
                note={day.sealed && owed.length === 0 ? tomorrowWords(tomorrow) : ""}
            />
            <TodayTodos now={now} />
        </DayLayout>
    );
};

/**
 * Today: the day as one list, in the order it is lived, with how it is going drawn above it.
 * The data and the changes come from TodayContext; lib/day.js turns the lists into the day,
 * and lib/dayMessage.js and lib/recap.js find the words.
 */
const TodayPage = () => {
    const today = useToday();
    const { status, date, routines, habits, week, streak, pending } = today;
    const { ensure, retry, refresh, subscribe } = today;
    const { setRoutineDone, setHabitQuantity, stepHabit } = today;
    const { createItem } = usePlan();
    const { user } = useAuth();
    const now = useNow();

    // What this browser remembers about Today for this account: the recap it has shown, blocks folded
    const account = user?._id ?? user?.id ?? user?.email ?? "account";
    const [memory, setMemory] = useRemembered(`today.${account}`, NOTHING_REMEMBERED);

    const [reopening, setReopening] = useState(null);
    // The form a routine or a habit is made or changed in, and the question of a counted habit's amount
    const [editing, setEditing] = useState(null);
    const [counting, setCounting] = useState(null);
    // A new account's first routines and habits are being saved
    const [starting, setStarting] = useState(false);
    // The question stays worded while its dialog closes
    const asked = useLastValue(reopening);
    const question = asked ? reopenWords(asked) : null;

    useEffect(() => {
        ensure();
    }, [ensure]);

    const day = useMemo(
        () => buildDay({ routines, habits, now, pending }),
        [routines, habits, now, pending],
    );
    const fresh = status === "ready" && looksNew(today, day);
    // A new account is offered a few things to begin with, unless it has said it would rather add its own.
    // While they are being saved the offer stays, though the day is no longer empty: the list is shown whole.
    const offering = (fresh && memory.starters !== "skipped") || starting;

    // ── The line under the date. "Today is complete" is not said until the server has taken the last tick. ──
    const yesterday = useMemo(
        () => tallyOf(week.find((summary) => summary.date === (date && addDays(date, -1)))),
        [week, date],
    );
    const message = useHeldMessage(
        dayMessage(day, { nowMinutes: minutesOf(now), date, yesterday, streak }),
        day.complete && !day.sealed,
    );

    // ── The recap of the days that have closed, until it is put away ──
    const recapFrame = date ? recapWindow(memory.recap, date) : null;
    const recap = recapFrame && !recapFrame.dismissed ? buildRecap(today.recap, recapFrame) : null;
    const recapNeedsNoting = Boolean(recapFrame) && memory.recap?.day !== recapFrame.day;

    // Remembered the first time it is shown on a day, so tomorrow's reports only what closes after this
    useEffect(() => {
        if (recapNeedsNoting) {
            setMemory((current) => ({ ...current, recap: recapWindow(current.recap, date) }));
        }
    }, [recapNeedsNoting, date, setMemory]);

    const dismissRecap = () =>
        setMemory((current) => ({
            ...current,
            recap: { ...recapWindow(current.recap, date), dismissed: true },
        }));

    // ── What follows from a change, once the server has accepted it, is the shell's to say: the toast
    //    for something completed, a level reached, a run reaching a milestone (see DayNotices). Only the
    //    word about a new day is this screen's. ──
    useEffect(
        () =>
            subscribe((event) => {
                if (event.type !== "day") return;

                if (!document.hidden && minutesOf(new Date()) < JUST_AFTER_MIDNIGHT_MINUTES) {
                    toast(NEW_DAY_WORDS, { id: "today-new-day" });
                }
            }),
        [subscribe],
    );

    // ── Midnight going by while the screen is open ──
    const deviceDay = localDay(now);
    const dayOnScreen = useRef(deviceDay);

    useEffect(() => {
        if (dayOnScreen.current === deviceDay) return undefined;
        dayOnScreen.current = deviceDay;

        refresh();
        const timers = NEW_DAY_RETRIES_MS.map((delay) => setTimeout(refresh, delay));
        return () => timers.forEach(clearTimeout);
    }, [deviceDay, refresh]);

    // Until the lists arrive the date is this device's; after that, the day the server counts as today
    const header = (action) => (
        <DayHeader
            eyebrow={greetingAt(now)}
            title={formatDayTitle(date ?? localDay(now))}
            action={action}
        />
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header()}
                    <ErrorState className={styles.state} title="Today didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    if (status !== "ready") {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading today
                </p>
                <DaySkeleton />
            </Page>
        );
    }

    const check = (item, checked) => {
        if (item.kind === "routine") {
            setRoutineDone(item.id, checked);
        } else if (item.counted) {
            // Ticking fills in whatever is left; un-ticking takes one step back off the target
            setHabitQuantity(item.id, checked ? item.target : stepQuantity(item.target, item.target, -1));
        } else {
            setHabitQuantity(item.id, checked ? 1 : 0);
        }
    };

    // The one un-tick that is asked about first
    const onCheck = (item, checked) => {
        if (!checked && reopeningCosts(item)) {
            setReopening(item);
        } else {
            check(item, checked);
        }
    };

    const onStep = (item, direction) => stepHabit(item.id, direction);

    // The form works on the item as the API sent it, not on its row
    const onEdit = (item) => {
        const source = (item.kind === "routine" ? routines : habits).find((entry) => entry._id === item.id);
        if (source) setEditing({ kind: item.kind, item: source });
    };
    const editor = <ItemEditor request={editing} onClose={() => setEditing(null)} />;

    /**
     * Saves the starters a new account chose.
     * inPlace: the offer is on screen and waits there until all of them have been tried. Without it they
     *          are added to the list that is already showing (a second try for the ones that failed).
     */
    const start = async (starters, { inPlace = true } = {}) => {
        if (inPlace) setStarting(true);
        const { made, failed } = await addStarters(starters, createItem);

        if (inPlace) {
            setStarting(false);
            // The list takes the offer's place, and starts from its top
            if (made > 0) window.scrollTo({ top: 0 });
        }
        if (failed.length > 0) {
            const words = startersFailedWords(made, failed.length);

            toast.error(words.message, {
                id: "today-starters",
                detail: words.detail,
                action: { label: "Try again", onClick: () => start(failed, { inPlace: made === 0 && inPlace }) },
            });
        }
    };

    const setStarters = (answer) => setMemory((current) => ({ ...current, starters: answer }));

    if (offering) {
        return (
            <Page>
                <DayLayout>
                    {header()}
                    <FirstDay
                        now={now}
                        busy={starting}
                        onStart={start}
                        onSkip={() => setStarters("skipped")}
                    />
                </DayLayout>
            </Page>
        );
    }

    if (day.total === 0) {
        // An account with nothing in it yet is offered its first steps in the page itself, not from the corner
        return (
            <Page>
                <DayLayout
                    aside={
                        fresh ? null : (
                            <WeekAside date={date} summaries={week} today={{ total: 0, done: 0 }} streak={streak} />
                        )
                    }
                >
                    {header(!fresh && <NewItemMenu onNew={setEditing} />)}
                    <DayRecap recap={recap} onDismiss={dismissRecap} />
                    {fresh ? (
                        <EmptyState
                            className={styles.state}
                            title="Your day starts here"
                            actions={
                                <>
                                    <Button variant="primary" onClick={() => setEditing({ kind: "routine" })}>
                                        Add a routine
                                    </Button>
                                    <Button onClick={() => setEditing({ kind: "habit" })}>Add a habit</Button>
                                </>
                            }
                        >
                            Add the first thing you want to do today. A routine has a time; a habit
                            is kept through the day. Or{" "}
                            <button
                                type="button"
                                className={styles.textButton}
                                onClick={() => setStarters("offered")}
                            >
                                start from a few suggestions
                            </button>
                            .
                        </EmptyState>
                    ) : (
                        <EmptyState
                            className={styles.state}
                            title="Nothing is planned for today"
                            actions={
                                <Button
                                    variant="primary"
                                    onClick={() => setEditing({ kind: "routine", once: true })}
                                >
                                    Add something for today
                                </Button>
                            }
                        >
                            Your routines and habits come back on their own days. A free day costs
                            no XP.
                        </EmptyState>
                    )}
                    {!fresh && (
                        <>
                            <OwedNote owed={today.owed} />
                            <TodayTodos now={now} />
                        </>
                    )}
                </DayLayout>
                {editor}
            </Page>
        );
    }

    return (
        <Page>
            <TodayList
                today={today}
                day={day}
                now={now}
                message={message}
                recap={recap}
                onDismissRecap={dismissRecap}
                memory={memory}
                setMemory={setMemory}
                onCheck={onCheck}
                onStep={onStep}
                onNew={setEditing}
                onEdit={onEdit}
                onSetAmount={setCounting}
            />
            {editor}
            <AmountDialog
                item={counting}
                onSave={(item, amount) => setHabitQuantity(item.id, amount)}
                onClose={() => setCounting(null)}
            />
            <ConfirmDialog
                open={Boolean(reopening)}
                onOpenChange={(open) => {
                    if (!open) setReopening(null);
                }}
                title={question?.title}
                description={question?.description}
                confirmLabel={question?.confirm}
                cancelLabel={question?.cancel}
                onConfirm={() => check(reopening, false)}
            />
        </Page>
    );
};

export default TodayPage;
