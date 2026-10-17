import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import PlanCalendar from "./PlanCalendar";
import PlanItemMenu from "./PlanItemMenu";
import PlanRow from "./PlanRow";
import PlanSkeleton from "./PlanSkeleton";
import PlanWeek from "./PlanWeek";
import useReorder from "./useReorder";
import { Link } from "react-router-dom";
import { DayLayout } from "../../components/day";
import { ItemEditor, NewItemMenu, PauseDialog } from "../../components/plan";
import Page from "../../components/shell/Page";
import { Button, EmptyState, ErrorState, SectionHeader, SegmentedControl } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useListKeys, { focusRow } from "../../hooks/useListKeys";
import useMediaQuery from "../../hooks/useMediaQuery";
import useNow from "../../hooks/useNow";
import usePlan from "../../hooks/usePlan";
import useRemembered from "../../hooks/useRemembered";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { addDays, localDay, weekdayOf } from "../../lib/dates";
import { movedWords, planWords, retimedWords, weekStandingWords } from "../../lib/itemWords";
import { buildDay } from "../../lib/day";
import { buildPlan, findPlanItem, moveWithin, weekStanding } from "../../lib/plan";
import { ARCHIVE_PATH } from "../../lib/places";
import { KEYS } from "../../lib/shortcuts";
import { fromMinutes, toMinutes } from "../../lib/time";
import { toast } from "../../lib/toast";
import { firstDayOfWeek, weekdayName } from "../../lib/week";
import historyService from "../../services/historyService";
import styles from "./PlanPage.module.css";

/**
 * One part of the day in the plan: a heading over its rows. Its routines stand in the order of the clock;
 * its habits follow in an order that can be changed, by dragging or from the keyboard.
 *
 * block: from buildPlan
 * reorderable: its habits may be put in another order (not while one day of this week is picked out)
 * onReorder(ids, { id, to }): its habits' ids in their new order
 * the rest is passed to each row and its menu
 */
const PlanBlock = ({
    block,
    reorderable,
    today,
    firstDay,
    onReorder,
    onEdit,
    onDelete,
    onPause,
    onResume,
    onRetire,
    onShowUnder,
}) => {
    // One still on its way to the server has no id to be put in order by yet
    const habitIds = block.items.filter((item) => item.kind === "habit" && !item.saving).map((item) => item.id);
    const canReorder = reorderable && habitIds.length > 1;
    const { handleProps, rowStyle, dragging, settling } = useReorder({ ids: habitIds, onReorder });

    const move = (item, direction) => {
        const from = habitIds.indexOf(item.id);
        onReorder(moveWithin(habitIds, from, from + direction), { id: item.id, to: from + direction });
    };

    return (
        <section className={styles.block} aria-label={block.label}>
            <SectionHeader
                className={styles.head}
                title={block.label}
                meta={String(block.items.length)}
            />
            <ul
                className={cx(styles.rows, (dragging || settling) && styles.held, settling && styles.settling)}
                data-reorder-list=""
            >
                <AnimatePresence initial={false}>
                    {block.items.map((item) => {
                        const place = habitIds.indexOf(item.id);
                        const sortable = canReorder && item.kind === "habit" && !item.saving;

                        return (
                            <PlanRow
                                key={item.row}
                                item={item}
                                today={today}
                                firstDay={firstDay}
                                handle={sortable ? handleProps(item.id) : null}
                                dragging={dragging === item.id}
                                style={sortable ? rowStyle(item.id) : undefined}
                                menu={
                                    item.saving ? null : <PlanItemMenu
                                        item={item}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onPause={onPause}
                                        onResume={onResume}
                                        onRetire={onRetire}
                                        onShowUnder={onShowUnder}
                                        onMove={sortable ? move : null}
                                        canMoveUp={place > 0}
                                        canMoveDown={place < habitIds.length - 1}
                                    />
                                }
                            />
                        );
                    })}
                </AnimatePresence>
            </ul>
        </section>
    );
};

/**
 * Plan: everything the account has set itself to do, by part of the day, with the days each thing falls on.
 * Things are made, changed, put in order and deleted here; ticking them off belongs to Today.
 * The lists come from PlanContext (routines) and TodayContext (habits); lib/plan.js lays them out.
 */
// The two ways the plan is shown: the week as a calendar, or a list by part of the day
const VIEWS = [
    { value: "calendar", label: "Calendar", icon: "calendar" },
    { value: "list", label: "List", icon: "plan" },
];

const PlanPage = () => {
    const plan = usePlan();
    const today = useToday();
    const { user } = useAuth();
    const now = useNow();
    const { ensure, retry, reorderHabits, deleteItem, retireItem, resumeItem, updateItem } = plan;
    const account = user?._id ?? user?.id ?? user?.email ?? "account";
    const [view, setView] = useRemembered(`plan.view.${account}`, "calendar");
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone

    const [firstDay] = useState(firstDayOfWeek);
    // One day of this week picked out ("YYYY-MM-DD"), or the whole plan
    const [pickedDay, setPickedDay] = useState(null);
    const [editing, setEditing] = useState(null);
    const [pausing, setPausing] = useState(null);
    const [said, setSaid] = useState("");

    useEffect(() => {
        ensure();
    }, [ensure]);

    const { routines } = plan;
    const { habits } = today;
    const date = today.date ?? localDay();
    const whole = useMemo(
        () => buildPlan({ routines, habits, today: date, firstDay }),
        [routines, habits, date, firstDay],
    );
    // How the week has gone: the days that have ended by their record, today as it stands on Today
    const live = useMemo(
        () => buildDay({ routines: today.routines, habits, pending: today.pending }),
        [today.routines, habits, today.pending],
    );
    const standing = useMemo(
        () => weekStanding(whole.week, { summaries: today.week, today: { date, total: live.total, done: live.done } }),
        [whole.week, today.week, date, live.total, live.done],
    );
    // How each routine and habit stood on the days of this week that have ended, for the calendar
    const weekStart = whole.week[0]?.date ?? date;
    const yesterday = addDays(date, -1);
    const marked = useFetched(
        view === "calendar" && weekStart <= yesterday ? `marks:${account}:${weekStart}:${yesterday}` : null,
        () => historyService.getMarks(weekStart, yesterday),
    );
    const marks = useMemo(
        () => new Map((marked.data?.marks ?? []).map((mark) => [`${mark.date}|${mark.kind}|${mark.id}`, mark])),
        [marked.data],
    );
    const liveByKey = useMemo(() => new Map(live.items.map((item) => [item.key, item])), [live.items]);

    // A day picked out last week is no longer one of this week's
    const picked = whole.week.some((entry) => entry.date === pickedDay) ? pickedDay : null;
    const shown = useMemo(
        () => (picked === null ? whole : buildPlan({ routines, habits, today: date, day: picked, firstDay })),
        [whole, routines, habits, date, picked, firstDay],
    );

    const failed = plan.status === "error" || today.status === "error";
    const ready = plan.status === "ready" && today.status === "ready";

    // The rows from the keyboard: Enter on a name opens its page as any link does; these are the rest
    const itemOf = (key) => findPlanItem({ routines, habits }, ...key.split(":"));
    useListKeys(
        {
            [KEYS.edit]: (key) => {
                const item = itemOf(key);
                if (!item || item.saving) return false;
                setEditing({ kind: item.kind, item: item.source });
                return true;
            },
            [KEYS.remove]: (key, row, neighbour) => {
                const item = itemOf(key);
                if (!item || item.saving) return false;
                // The row is about to go: the keyboard moves on to the one beside it
                focusRow(neighbour);
                deleteItem(item.kind, item.source);
                return true;
            },
        },
        ready && !whole.empty,
    );

    const calendar = view === "calendar";
    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                {/* With nothing planned, the page below says so itself */}
                <p className={styles.eyebrow}>
                    {ready && !whole.empty ? planWords(whole, calendar ? null : picked, date) : " "}
                </p>
                <h1 className={styles.title}>Plan</h1>
            </div>
            {ready && !whole.empty && (
                <div className={styles.tools}>
                    <SegmentedControl
                        label="Show the plan as"
                        options={VIEWS}
                        value={view}
                        onChange={setView}
                        // The two words would crowd the title on a phone: the icons, the words kept for screen readers
                        iconOnly={isPhone}
                    />
                    <NewItemMenu onNew={setEditing} />
                </div>
            )}
        </header>
    );
    const editor = (
        <>
            <ItemEditor request={editing} onClose={() => setEditing(null)} />
            <PauseDialog request={pausing} onClose={() => setPausing(null)} />
        </>
    );
    // Where retired things are kept, said under the plan (and under nothing, when nothing is planned)
    const archiveNote = (
        <p className={styles.archiveNote}>
            Routines and habits you retire are kept in <Link to={ARCHIVE_PATH}>Archive</Link>, with their
            history, to bring back whenever you want them again.
        </p>
    );

    if (failed) {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="The plan didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    if (!ready) {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading the plan
                </p>
                <PlanSkeleton />
            </Page>
        );
    }

    if (whole.empty) {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <EmptyState
                        className={styles.state}
                        title="Nothing is planned yet"
                        actions={
                            <>
                                <Button variant="primary" onClick={() => setEditing({ kind: "routine" })}>
                                    Add a routine
                                </Button>
                                <Button onClick={() => setEditing({ kind: "habit" })}>Add a habit</Button>
                            </>
                        }
                    >
                        A routine has a time of day and the days it falls on. A habit is kept through
                        the day, with no set time. Each one you add shows up on Today when it is due.
                    </EmptyState>
                    {archiveNote}
                </DayLayout>
                {editor}
            </Page>
        );
    }

    const edit = (item) => setEditing({ kind: item.kind, item: item.source });
    const remove = (item) => deleteItem(item.kind, item.source);
    const pause = (item) => setPausing({ kind: item.kind, item: item.source });
    const resume = (item) => resumeItem(item.kind, item.source);
    const retire = (item) => retireItem(item.kind, item.source);
    const showUnder = (item, block) => today.moveHabit(item.id, block);

    const reorder = (ids, { id, to }) => {
        reorderHabits(ids);
        setSaid(movedWords(habits.find((habit) => habit._id === id)?.title ?? "", to + 1, ids.length));
    };

    const week = (layout) => (
        <PlanWeek layout={layout} standing={standing} selected={picked} onSelect={setPickedDay} />
    );
    // An empty hour on the calendar: a new routine there, on that day of the week, an hour long
    const createAt = (day, time) =>
        setEditing({
            kind: "routine",
            start: time,
            end: fromMinutes(Math.min(toMinutes(time) + 60, 23 * 60 + 45)),
            days: [weekdayOf(day)],
        });

    // A routine carried to another time keeps its length, and moves on every day it falls on
    const retime = (item, { start, end }) => {
        const was = { startTime: item.source.startTime, endTime: item.source.endTime ?? "" };
        updateItem("routine", item.id, { startTime: start, endTime: end ?? "" }).then(
            () =>
                toast(retimedWords(item.title, start, Boolean(item.once)), {
                    id: `plan-retimed-${item.id}`,
                    action: { label: "Undo", onClick: () => updateItem("routine", item.id, was).catch(() => {}) },
                }),
            () => toast.error(`“${item.title}” didn’t move. Check your connection and try again.`),
        );
    };

    if (calendar) {
        const tally = weekStandingWords(standing);

        return (
            <Page>
                <div className={styles.wide}>
                    {header}
                    {tally.length > 0 && <p className={styles.tally}>{tally.join(" ")}</p>}
                    <PlanCalendar
                        standing={standing}
                        marks={marks}
                        live={liveByKey}
                        now={now}
                        onCreate={createAt}
                        onMove={retime}
                    />
                    {archiveNote}
                </div>
                {editor}
            </Page>
        );
    }

    const rowProps = {
        today: date,
        firstDay,
        onEdit: edit,
        onDelete: remove,
        onPause: pause,
        onResume: resume,
        onRetire: retire,
        onShowUnder: showUnder,
    };

    return (
        <Page>
            <DayLayout aside={<div className={styles.beside}>{week("column")}</div>}>
                {header}
                <div className={styles.above}>{week("row")}</div>

                {/* Keyed by the day picked out: a different day is a different list, not rows coming and going */}
                <div key={picked ?? "plan"}>
                    {shown.blocks.map((block) => (
                        <PlanBlock
                            key={block.id}
                            block={block}
                            reorderable={picked === null}
                            onReorder={reorder}
                            {...rowProps}
                        />
                    ))}

                    {shown.upcoming.length > 0 && (
                        <section className={styles.block} aria-label="One-off tasks">
                            <SectionHeader
                                className={styles.head}
                                title="One-off tasks"
                                meta={String(shown.upcoming.length)}
                            />
                            <ul className={styles.rows}>
                                <AnimatePresence initial={false}>
                                    {shown.upcoming.map((item) => (
                                        <PlanRow
                                            key={item.row}
                                            item={item}
                                            today={date}
                                            firstDay={firstDay}
                                            menu={item.saving ? null : <PlanItemMenu item={item} onEdit={edit} onDelete={remove} />}
                                        />
                                    ))}
                                </AnimatePresence>
                            </ul>
                        </section>
                    )}

                    {shown.blocks.length === 0 && shown.upcoming.length === 0 && picked !== null && (
                        <EmptyState
                            className={styles.state}
                            size="sm"
                            segments={0}
                            title={picked === date ? "Today is free" : `${weekdayName(weekdayOf(picked))} is free`}
                            actions={
                                <Button size="sm" onClick={() => setPickedDay(null)}>
                                    Show the whole plan
                                </Button>
                            }
                        >
                            Nothing in the plan falls on this day.
                        </EmptyState>
                    )}
                </div>

                {archiveNote}

                <p className="visually-hidden" aria-live="polite">
                    {said}
                </p>
            </DayLayout>
            {editor}
        </Page>
    );
};

export default PlanPage;
