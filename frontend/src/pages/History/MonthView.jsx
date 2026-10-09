import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dayPath, monthPath } from "./historyPaths";
import { DayLayout, MiniStrip } from "../../components/day";
import { HOME_PATH } from "../../components/shell/navigation";
import Page from "../../components/shell/Page";
import { Button, Calendar, EmptyState, ErrorState, Fact, Facts, Skeleton } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useMediaQuery from "../../hooks/useMediaQuery";
import useNow from "../../hooks/useNow";
import useToday from "../../hooks/useToday";
import { firstDayOf, formatDayShort, formatMonthName, lastDayOf, monthOf } from "../../lib/dates";
import { buildDay } from "../../lib/day";
import { buildMonth } from "../../lib/history";
import {
    calendarDayWords,
    HISTORY_LEGEND,
    monthWords,
    NOTHING_YET,
    signedXp,
} from "../../lib/historyWords";
import historyService from "../../services/historyService";
import styles from "./HistoryPage.module.css";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();
const daysOf = (count) => `${numberFormat.format(count)}${NBSP}${count === 1 ? "day" : "days"}`;

// Beside the calendar: what the month's ended days add up to
const MonthFacts = ({ month, stats }) => (
    <section>
        <h2 className={styles.heading}>{formatMonthName(month)}</h2>
        <Facts>
            <Fact label="Days on record">{numberFormat.format(stats.days)}</Fact>
            <Fact label="Everything done">{daysOf(stats.perfect)}</Fact>
            {stats.longestRun > 1 && <Fact label="Longest run">{daysOf(stats.longestRun)}</Fact>}
            {stats.total > 0 && (
                <Fact label="Done">
                    {numberFormat.format(stats.done)} of {numberFormat.format(stats.total)}
                </Fact>
            )}
            <Fact label="XP earned">{signedXp(stats.gained)}</Fact>
            {stats.lost > 0 && (
                <Fact label="XP lost" tone="loss">
                    {signedXp(-stats.lost)}
                </Fact>
            )}
        </Facts>
    </section>
);

/**
 * One month of History: a sentence for the month, then its days, each drawn as the small strip of its
 * own day. Pressing a day opens it. The calendar is on screen from the first moment; the strips arrive in it.
 *
 * month: "YYYY-MM". today: "YYYY-MM-DD"
 */
const MonthView = ({ month, today }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { status: todayStatus, routines, habits } = useToday();
    const now = useNow();
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone

    const account = user?._id ?? user?.id ?? user?.email ?? "account";
    const { data, status, retry } = useFetched(`days:${account}:${month}`, () =>
        historyService.getDays(firstDayOf(month), lastDayOf(month)),
    );

    // Today as it stands, which no stored summary can know
    const live = useMemo(() => {
        if (todayStatus !== "ready") return null;

        const day = buildDay({ routines, habits, now });
        return { total: day.total, done: day.done };
    }, [todayStatus, routines, habits, now]);

    const { marks, stats } = useMemo(
        () => buildMonth({ month, days: data?.days, today, live }),
        [month, data, today, live],
    );

    const ready = status === "ready";
    const current = month === monthOf(today);
    const since = data?.since ?? null;
    // Nothing has ever closed, and nothing is on today either
    const nothingYet = ready && since === null && !(live && live.total > 0);
    const words = ready ? monthWords(stats, { current }) : null;

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{since ? `On record since ${formatDayShort(since)}` : " "}</p>
                <h1 className={styles.title}>History</h1>
            </div>
        </header>
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="History didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    if (nothingYet) {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <EmptyState
                        className={styles.state}
                        title={NOTHING_YET.history.title}
                        actions={
                            <Button as={Link} to={HOME_PATH} variant="primary">
                                Go to Today
                            </Button>
                        }
                    >
                        {NOTHING_YET.history.body}
                    </EmptyState>
                </DayLayout>
            </Page>
        );
    }

    return (
        <Page>
            <DayLayout aside={ready && stats.days > 0 ? <MonthFacts month={month} stats={stats} /> : null}>
                {header}
                <p className={styles.summary} aria-live="polite">
                    {words ? (
                        <>
                            <b>{words.lead}</b> {words.rest}
                        </>
                    ) : (
                        <Skeleton variant="text" width="min(34ch, 90%)" />
                    )}
                </p>
                <Calendar
                    full
                    className={styles.calendar}
                    label="History, day by day"
                    month={month}
                    onMonthChange={(next) => navigate(monthPath(next), { replace: true })}
                    today={today}
                    // Until the first day on record is known, only this month can be shown
                    min={since ?? firstDayOf(month)}
                    max={today}
                    onSelect={(day) => navigate(day === today ? HOME_PATH : dayPath(day))}
                    strongDay={(day) => Boolean(marks.get(day)?.perfect)}
                    describeDay={(day) => (ready ? calendarDayWords(marks.get(day)) : "")}
                    renderDay={(day) => {
                        const mark = marks.get(day);
                        return (
                            <MiniStrip
                                total={mark?.total}
                                done={mark?.done}
                                settled={mark?.settled}
                                whole={isPhone}
                            />
                        );
                    }}
                />
                <p className={styles.legend}>{HISTORY_LEGEND}</p>
            </DayLayout>
        </Page>
    );
};

export default MonthView;
