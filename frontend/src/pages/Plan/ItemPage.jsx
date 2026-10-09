import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DayLayout } from "../../components/day";
import { ItemEditor } from "../../components/plan";
import Page from "../../components/shell/Page";
import { Button, Calendar, EmptyState, ErrorState, Fact, Facts, Icon, Kbd, Skeleton } from "../../components/ui";
import useHotkeys from "../../hooks/useHotkeys";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { formatDayBrief, localDay, monthOf } from "../../lib/dates";
import { BLOCKS } from "../../lib/day";
import { CATEGORIES } from "../../lib/itemForm";
import {
    dayStatusWords,
    detailWords,
    historyWords,
    KIND_WORDS,
    patternWords,
    stakesWords,
} from "../../lib/itemWords";
import { findPlanItem } from "../../lib/plan";
import { KEYS } from "../../lib/shortcuts";
import habitService from "../../services/habitService";
import routineService from "../../services/routineService";
import { PLAN_PATH } from "./planPaths";
import styles from "./ItemPage.module.css";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();
const services = { routine: routineService, habit: habitService };

// What each kind of day is called under the calendar, in the order they are listed
const LEGEND = [
    ["done", "Done"],
    ["late", "Late"],
    ["partial", "Partly"],
    ["missed", "Missed"],
];

// The small square a day carries: filled when it was done, part filled for a count that fell short,
// an empty outline in the colour of a loss when it was missed
const Mark = ({ status, share = 0 }) => (
    <span className={cx(styles.mark, styles[status])}>
        {status === "partial" && <i style={{ height: `${Math.round(share * 100)}%` }} />}
    </span>
);

/**
 * One routine or habit on a page of its own: when it falls, what is at stake, and how it has gone,
 * month by month.
 * kind: "routine" or "habit". The id comes from the address.
 */
const ItemPage = ({ kind }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const plan = usePlan();
    const today = useToday();
    const { ensure, retry } = plan;

    const [editing, setEditing] = useState(null);
    const [month, setMonth] = useState(null);
    // The history, and which item it was fetched for
    const [fetched, setFetched] = useState({ key: null, data: null, failed: false });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        ensure();
    }, [ensure]);

    const item = findPlanItem({ routines: plan.routines, habits: today.habits }, kind, id);
    const exists = Boolean(item);
    const key = `${kind}:${id}`;

    useEffect(() => {
        if (!exists) return undefined;
        let current = true;

        services[kind]
            .getHistory(id)
            .then((data) => current && setFetched({ key, data, failed: false }))
            .catch(() => current && setFetched({ key, data: null, failed: true }));

        return () => {
            current = false;
        };
    }, [kind, id, key, exists, attempt]);

    const date = today.date ?? localDay();
    const ready = plan.status === "ready" && today.status === "ready";
    const failed = plan.status === "error" || today.status === "error";
    const history = fetched.key === key ? fetched : { data: null, failed: false };

    // The same key that edits a row on Plan edits the item its page is about
    useHotkeys({ [KEYS.edit]: () => setEditing({ kind, item: item.source }) }, ready && exists);

    const back = (
        <Link to={PLAN_PATH} className={styles.back}>
            <Icon name="arrow-left" size={14} />
            Plan
        </Link>
    );

    if (failed) {
        return (
            <Page>
                <DayLayout>
                    {back}
                    <ErrorState className={styles.state} title="This didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    if (!ready) {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading
                </p>
                <DayLayout>
                    <div aria-hidden="true">
                        <div className={cx(styles.back, styles.line)}>
                            <Skeleton variant="text" width="5ch" />
                        </div>
                        <div className={cx(styles.title, styles.line)}>
                            <Skeleton variant="text" width="min(10em, 70%)" />
                        </div>
                        <div className={cx(styles.summary, styles.line)}>
                            <Skeleton variant="text" width="min(28ch, 90%)" />
                        </div>
                    </div>
                </DayLayout>
            </Page>
        );
    }

    if (!item) {
        return (
            <Page>
                <DayLayout>
                    {back}
                    <EmptyState
                        as="h1"
                        className={styles.state}
                        title="This is no longer in the plan"
                        actions={
                            <Button as={Link} to={PLAN_PATH} variant="primary">
                                Go to Plan
                            </Button>
                        }
                    >
                        It may have been deleted, or the link may be out of date.
                    </EmptyState>
                </DayLayout>
            </Page>
        );
    }

    const source = item.source;
    const detail = detailWords(item);
    const days = new Map((history.data?.days ?? []).map((day) => [day.date, day]));
    const present = LEGEND.filter(([status]) => history.data?.days.some((day) => day.status === status));
    const words = history.data ? historyWords(history.data, { once: Boolean(item.once) }) : null;
    const category = CATEGORIES.find((entry) => entry.value === source.category)?.label;
    const since = source.createdAt ? localDay(new Date(source.createdAt)) : null;

    const facts = (
        <section>
            <h2 className={styles.heading}>{KIND_WORDS[kind].title}</h2>
            <Facts>
                <Fact label="Falls on">{patternWords(item, { today: date })}</Fact>
                {kind === "routine" && <Fact label="Time">{detail}</Fact>}
                {kind === "habit" && (
                    <Fact label="Part of the day">
                        {BLOCKS.find((block) => block.id === item.block)?.label}
                    </Fact>
                )}
                {kind === "habit" && item.counted && <Fact label="Target">{detail}</Fact>}
                <Fact label="Worth">
                    {numberFormat.format(item.worth)}
                    {NBSP}XP
                </Fact>
                {category && <Fact label="Category">{category}</Fact>}
                {since && <Fact label="In the plan since">{formatDayBrief(since)}</Fact>}
            </Facts>
            <p className={styles.stakes}>
                {stakesWords(kind, {
                    worth: item.worth,
                    hasEnd: item.end !== null,
                    once: Boolean(item.once),
                })}
            </p>
        </section>
    );

    return (
        <Page>
            <DayLayout aside={facts}>
                <header className={styles.header}>
                    <div className={styles.text}>
                        {back}
                        <h1 className={styles.title}>{item.title}</h1>
                    </div>
                    <Button
                        icon="edit"
                        trailing={<Kbd keys={KEYS.edit} />}
                        onClick={() => setEditing({ kind, item: source })}
                    >
                        Edit
                    </Button>
                </header>

                {history.failed ? (
                    <ErrorState
                        className={styles.state}
                        size="sm"
                        title="Its history didn’t load"
                        onRetry={() => setAttempt((count) => count + 1)}
                    />
                ) : (
                    <>
                        <p className={styles.summary}>
                            {words ? (
                                <>
                                    <b>{words.lead}</b> {words.rest}
                                </>
                            ) : (
                                <Skeleton variant="text" width="min(28ch, 90%)" />
                            )}
                        </p>
                        <Calendar
                            className={styles.calendar}
                            label={`${item.title}, day by day`}
                            month={month ?? monthOf(date)}
                            onMonthChange={setMonth}
                            today={date}
                            min={history.data?.since}
                            max={date}
                            describeDay={(day) => dayStatusWords(days.get(day), { unit: item.unit })}
                            renderDay={(day) => {
                                const entry = days.get(day);
                                if (!entry) return null;

                                return (
                                    <Mark
                                        status={entry.status}
                                        share={(entry.quantity ?? 0) / (item.target || 1)}
                                    />
                                );
                            }}
                        />
                        {present.length > 0 && (
                            <ul className={styles.legend}>
                                {present.map(([status, label]) => (
                                    <li key={status}>
                                        <Mark status={status} share={0.5} />
                                        {label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}

                {source.description && (
                    <section className={styles.notes}>
                        <h2 className={styles.heading}>Notes</h2>
                        <p>{source.description}</p>
                    </section>
                )}
            </DayLayout>
            <ItemEditor
                request={editing}
                onClose={() => setEditing(null)}
                onDeleted={() => navigate(PLAN_PATH)}
            />
        </Page>
    );
};

export default ItemPage;
