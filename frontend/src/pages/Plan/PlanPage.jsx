import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import PlanItemMenu from "./PlanItemMenu";
import PlanRow from "./PlanRow";
import PlanSkeleton from "./PlanSkeleton";
import PlanWeek from "./PlanWeek";
import useReorder from "./useReorder";
import { DayLayout } from "../../components/day";
import { ItemEditor, NewItemMenu } from "../../components/plan";
import Page from "../../components/shell/Page";
import { Button, EmptyState, ErrorState, SectionHeader } from "../../components/ui";
import useListKeys, { focusRow } from "../../hooks/useListKeys";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { localDay, weekdayOf } from "../../lib/dates";
import { movedWords, planWords } from "../../lib/itemWords";
import { buildPlan, findPlanItem, moveWithin } from "../../lib/plan";
import { KEYS } from "../../lib/shortcuts";
import { firstDayOfWeek, weekdayName } from "../../lib/week";
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
const PlanBlock = ({ block, reorderable, today, firstDay, onReorder, onEdit, onDelete, onShowUnder }) => {
    const habitIds = block.items.filter((item) => item.kind === "habit").map((item) => item.id);
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
                        const sortable = canReorder && item.kind === "habit";

                        return (
                            <PlanRow
                                key={item.key}
                                item={item}
                                today={today}
                                firstDay={firstDay}
                                handle={sortable ? handleProps(item.id) : null}
                                dragging={dragging === item.id}
                                style={sortable ? rowStyle(item.id) : undefined}
                                menu={
                                    <PlanItemMenu
                                        item={item}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
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
const PlanPage = () => {
    const plan = usePlan();
    const today = useToday();
    const { ensure, retry, reorderHabits, deleteItem } = plan;

    const [firstDay] = useState(firstDayOfWeek);
    // One day of this week picked out ("YYYY-MM-DD"), or the whole plan
    const [pickedDay, setPickedDay] = useState(null);
    const [editing, setEditing] = useState(null);
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
                if (!item) return false;
                setEditing({ kind: item.kind, item: item.source });
                return true;
            },
            [KEYS.remove]: (key, row, neighbour) => {
                const item = itemOf(key);
                if (!item) return false;
                // The row is about to go: the keyboard moves on to the one beside it
                focusRow(neighbour);
                deleteItem(item.kind, item.source);
                return true;
            },
        },
        ready && !whole.empty,
    );

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                {/* With nothing planned, the page below says so itself */}
                <p className={styles.eyebrow}>
                    {ready && !whole.empty ? planWords(whole, picked, date) : " "}
                </p>
                <h1 className={styles.title}>Plan</h1>
            </div>
            {ready && !whole.empty && <NewItemMenu onNew={setEditing} />}
        </header>
    );
    const editor = <ItemEditor request={editing} onClose={() => setEditing(null)} />;

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
                </DayLayout>
                {editor}
            </Page>
        );
    }

    const edit = (item) => setEditing({ kind: item.kind, item: item.source });
    const remove = (item) => deleteItem(item.kind, item.source);
    const showUnder = (item, block) => today.moveHabit(item.id, block);

    const reorder = (ids, { id, to }) => {
        reorderHabits(ids);
        setSaid(movedWords(habits.find((habit) => habit._id === id)?.title ?? "", to + 1, ids.length));
    };

    const week = (layout) => (
        <PlanWeek
            layout={layout}
            week={whole.week}
            selected={picked}
            onSelect={setPickedDay}
            today={date}
        />
    );
    const rowProps = { today: date, firstDay, onEdit: edit, onDelete: remove, onShowUnder: showUnder };

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
                                            key={item.key}
                                            item={item}
                                            today={date}
                                            firstDay={firstDay}
                                            menu={<PlanItemMenu item={item} onEdit={edit} onDelete={remove} />}
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

                <p className="visually-hidden" aria-live="polite">
                    {said}
                </p>
            </DayLayout>
            {editor}
        </Page>
    );
};

export default PlanPage;
