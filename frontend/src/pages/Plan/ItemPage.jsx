import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DayLayout } from "../../components/day";
import { ItemEditor, PauseDialog } from "../../components/plan";
import Page from "../../components/shell/Page";
import {
    Button,
    Calendar,
    EmptyState,
    ErrorState,
    Fact,
    Facts,
    Icon,
    IconButton,
    Kbd,
    Menu,
    ProgressBar,
    Skeleton,
} from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useHotkeys from "../../hooks/useHotkeys";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { formatDayBrief, localDay, monthOf } from "../../lib/dates";
import { BLOCKS } from "../../lib/day";
import { byWeekday } from "../../lib/history";
import { CATEGORIES } from "../../lib/itemForm";
import {
    dayStatusWords,
    detailWords,
    historyWords,
    KIND_WORDS,
    patternWords,
    pauseWords,
    stakesWords,
    weekdayRecordWords,
} from "../../lib/itemWords";
import { isPausedOn, pauseAhead } from "../../lib/pauses";
import { ARCHIVE_PATH } from "../../lib/places";
import { findPlanItem } from "../../lib/plan";
import { KEYS } from "../../lib/shortcuts";
import { weekdayName } from "../../lib/week";
import archiveService from "../../services/archiveService";
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
    ["off", "Off"],
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
 * month by month. One that has been retired is found in Archive instead, and can be brought back from here.
 * kind: "routine" or "habit". The id comes from the address.
 */
const ItemPage = ({ kind }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const plan = usePlan();
    const today = useToday();
    const { ensure, retry, retireItem, resumeItem, bringBackItem } = plan;
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const [editing, setEditing] = useState(null);
    const [pausing, setPausing] = useState(null);
    const [month, setMonth] = useState(null);
    // The history, and which item it was fetched for
    const [fetched, setFetched] = useState({ key: null, data: null, failed: false });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        ensure();
    }, [ensure]);

    const date = today.date ?? localDay();
    const ready = plan.status === "ready" && today.status === "ready";
    const planned = findPlanItem({ routines: plan.routines, habits: today.habits }, kind, id);

    // Not in the plan: it may have been retired. Archive is only asked for then.
    const archive = useFetched(ready && !planned ? `archive:${account}` : null, archiveService.getArchive);
    const retiredSource = planned
        ? null
        : (archive.data?.[kind === "routine" ? "routines" : "habits"] ?? []).find((entry) => entry._id === id);
    const retired = retiredSource
        ? findPlanItem(kind === "routine" ? { routines: [retiredSource] } : { habits: [retiredSource] }, kind, id)
        : null;

    const item = planned ?? retired;
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

    const failed = plan.status === "error" || today.status === "error";
    const history = fetched.key === key ? fetched : { data: null, failed: false };
    // Still looking for it in Archive
    const looking = ready && !planned && archive.status === "loading";

    // The same key that edits a row on Plan edits the item its page is about. A retired one can't be changed.
    useHotkeys({ [KEYS.edit]: () => setEditing({ kind, item: item.source }) }, ready && Boolean(planned));

    // A retired one is reached from Archive, and goes back there
    const back = (
        <Link to={retired ? ARCHIVE_PATH : PLAN_PATH} className={styles.back}>
            <Icon name="arrow-left" size={14} />
            {retired ? "Archive" : "Plan"}
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

    if (!ready || looking) {
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
                            <>
                                <Button as={Link} to={PLAN_PATH} variant="primary">
                                    Go to Plan
                                </Button>
                                <Button as={Link} to={ARCHIVE_PATH}>
                                    Open Archive
                                </Button>
                            </>
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
    const retiredOn = retired && source.archivedAt ? localDay(new Date(source.archivedAt)) : null;
    const pause = planned && !item.once ? pauseAhead(source, date) : null;
    // A day it was off, and has nothing else to show for
    const isOff = (day) => !days.has(day) && isPausedOn(source, day);
    // Which days of the week it is kept on and which it slips on, over its whole record
    const weekdays = history.data && !item.once ? byWeekday(history.data.days) : [];
    const legend = LEGEND.filter(([status]) =>
        status === "off"
            ? (source.pauses ?? []).some((entry) => entry.from <= date)
            : present.some(([shown]) => shown === status),
    );

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
                {retiredOn && <Fact label="Retired">{formatDayBrief(retiredOn)}</Fact>}
            </Facts>
            {/* A retired one asks nothing, so has nothing at stake */}
            {!retired && (
                <p className={styles.stakes}>
                    {stakesWords(kind, {
                        worth: item.worth,
                        hasEnd: item.end !== null,
                        once: Boolean(item.once),
                    })}
                </p>
            )}
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
                    {retired ? (
                        <Button variant="primary" icon="undo" onClick={() => bringBackItem(kind, source)}>
                            Bring back
                        </Button>
                    ) : (
                        <div className={styles.actions}>
                            <Button
                                icon="edit"
                                trailing={<Kbd keys={KEYS.edit} />}
                                onClick={() => setEditing({ kind, item: source })}
                            >
                                Edit
                            </Button>
                            {!item.once && (
                                <Menu
                                    align="end"
                                    trigger={<IconButton icon="more" label={`More for ${item.title}`} />}
                                >
                                    <Menu.Item icon="pause" onSelect={() => setPausing({ kind, item: source })}>
                                        {pause ? "Change pause…" : "Pause…"}
                                    </Menu.Item>
                                    {pause && (
                                        <Menu.Item icon="play" onSelect={() => resumeItem(kind, source)}>
                                            Resume now
                                        </Menu.Item>
                                    )}
                                    <Menu.Separator />
                                    <Menu.Item icon="archive" onSelect={() => retireItem(kind, source)}>
                                        Retire to Archive
                                    </Menu.Item>
                                </Menu>
                            )}
                        </div>
                    )}
                </header>

                {retired && (
                    <p className={styles.status}>
                        <Icon name="archive" size={14} />
                        <span>
                            Retired{retiredOn ? ` ${formatDayBrief(retiredOn)}` : ""}. It is kept in{" "}
                            <Link to={ARCHIVE_PATH}>Archive</Link> with its history, and asks nothing of any day
                            until it is brought back.
                        </span>
                    </p>
                )}
                {pause && (
                    <p className={styles.status}>
                        <Icon name="pause" size={14} />
                        <span>
                            {pauseWords(pause, date)}. Days off cost nothing and don’t break its run.{" "}
                            <button type="button" className={styles.inline} onClick={() => resumeItem(kind, source)}>
                                Resume now
                            </button>
                        </span>
                    </p>
                )}

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
                            full
                            className={styles.calendar}
                            label={`${item.title}, day by day`}
                            month={month ?? monthOf(date)}
                            onMonthChange={setMonth}
                            today={date}
                            min={history.data?.since}
                            max={date}
                            // A day it has a record for is set in full ink; the rest stay quiet
                            strongDay={(day) => days.has(day)}
                            describeDay={(day) =>
                                isOff(day) && day <= date ? "Off" : dayStatusWords(days.get(day), { unit: item.unit })
                            }
                            renderDay={(day) => {
                                const entry = days.get(day);
                                if (!entry) return isOff(day) && day <= date ? <Mark status="off" /> : null;

                                return (
                                    <Mark
                                        status={entry.status}
                                        share={(entry.quantity ?? 0) / (item.target || 1)}
                                    />
                                );
                            }}
                        />
                        {legend.length > 0 && (
                            <ul className={styles.legend}>
                                {legend.map(([status, label]) => (
                                    <li key={status}>
                                        <Mark status={status} share={0.5} />
                                        {label}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {weekdays.length > 1 && (
                            <section className={styles.weekdays} aria-labelledby="by-weekday">
                                <h2 id="by-weekday" className={styles.heading}>
                                    By day of the week
                                </h2>
                                <ul>
                                    {weekdays.map((row) => (
                                        <li key={row.day} className={styles.weekday}>
                                            <span>{weekdayName(row.day)}</span>
                                            <ProgressBar
                                                size="md"
                                                value={row.done}
                                                max={row.due}
                                                label={`${weekdayName(row.day)}: ${weekdayRecordWords(row)}`}
                                            />
                                            <span className={styles.kept}>{weekdayRecordWords(row)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
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
            <PauseDialog request={pausing} onClose={() => setPausing(null)} />
        </Page>
    );
};

export default ItemPage;
