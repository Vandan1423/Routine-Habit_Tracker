import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import InsightsSkeleton from "./InsightsSkeleton";
import ItemRanks from "./ItemRanks";
import Ledger from "./Ledger";
import MonthRows from "./MonthRows";
import WeekRows from "./WeekRows";
import { DayLayout } from "../../components/day";
import LevelIndicator from "../../components/shell/LevelIndicator";
import { HOME_PATH } from "../../components/shell/navigation";
import Page from "../../components/shell/Page";
import { AnimatedNumber, Button, EmptyState, ErrorState, Fact, Facts } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useNow from "../../hooks/useNow";
import useToday from "../../hooks/useToday";
import { formatDayTitle, localDay } from "../../lib/dates";
import { buildDay } from "../../lib/day";
import { streakNote } from "../../lib/dayMessage";
import { NOTHING_YET, signedXp, weekWords } from "../../lib/historyWords";
import { buildInsights, insightRange, itemRange, rankItems } from "../../lib/insights";
import { firstDayOfWeek } from "../../lib/week";
import historyService from "../../services/historyService";
import styles from "./InsightsPage.module.css";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();
const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;

// Beside the column: the level, the run, and what the last four weeks came to
const InsightsAside = ({ level, levelLoaded, streak, recent }) => (
    <>
        <section>
            <h2 className={styles.heading}>Level</h2>
            <LevelIndicator
                flush
                level={level.level}
                currentXp={level.currentXp}
                xpForNext={level.xpForNext}
                loading={!levelLoaded}
            />
            {levelLoaded && (
                <Facts className={styles.under}>
                    <Fact label={`To level ${numberFormat.format(level.level + 1)}`}>
                        {xp(Math.max(level.xpForNext - level.currentXp, 0))}
                    </Fact>
                    <Fact label="In all">{xp(level.totalXp ?? 0)}</Fact>
                </Facts>
            )}
        </section>
        {streak && (
            <section>
                <h2 className={styles.heading}>Run</h2>
                <p className={styles.figure}>
                    <AnimatedNumber value={streak.current} />{" "}
                    <small>{streak.current === 1 ? "day" : "days"}</small>
                </p>
                <p className={styles.note}>{streakNote(streak.current, streak.best)}</p>
            </section>
        )}
        {recent && recent.days > 0 && (
            <section>
                <h2 className={styles.heading}>The last 4 weeks</h2>
                <Facts>
                    <Fact label="Everything done">
                        {numberFormat.format(recent.perfect)} of {numberFormat.format(recent.days)}
                        {NBSP}days
                    </Fact>
                    <Fact label="XP earned">{signedXp(recent.gained)}</Fact>
                    {recent.lost > 0 && (
                        <Fact label="XP lost" tone="loss">
                            {signedXp(-recent.lost)}
                        </Fact>
                    )}
                </Facts>
            </section>
        )}
    </>
);

/**
 * Insights: how it has gone. A sentence about the week first, then the weeks drawn as rows of day strips,
 * the months, which routines and habits were kept and which were left, and the XP ledger with every
 * gain and loss named. The numbers come from the days as they were recorded (lib/insights.js);
 * the words from lib/historyWords.js.
 */
const InsightsPage = () => {
    const { user, levelInfo, levelLoaded } = useAuth();
    const { date, status: todayStatus, routines, habits, streak, ensure } = useToday();
    const now = useNow();
    const [firstDay] = useState(firstDayOfWeek);

    // Today's own tally stands in the current week's row, and only Today's lists know it
    useEffect(() => {
        ensure();
    }, [ensure]);

    const today = date ?? localDay();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const range = insightRange(today);
    const days = useFetched(`days:${account}:${range.from}:${range.to}`, () =>
        historyService.getDays(range.from, range.to),
    );
    const span = itemRange(today);
    const items = useFetched(`items:${account}:${span.from}:${span.to}`, () =>
        historyService.getItems(span.from, span.to),
    );

    const live = useMemo(() => {
        if (todayStatus !== "ready") return null;

        const day = buildDay({ routines, habits, now });
        return { total: day.total, done: day.done };
    }, [todayStatus, routines, habits, now]);

    const insights = useMemo(
        () => buildInsights({ days: days.data?.days, since: days.data?.since, today, live, firstDay }),
        [days.data, today, live, firstDay],
    );
    const ranks = useMemo(() => rankItems(items.data?.items), [items.data]);

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{formatDayTitle(today)}</p>
                <h1 className={styles.title}>Insights</h1>
            </div>
        </header>
    );
    const aside = (
        <InsightsAside
            level={levelInfo}
            levelLoaded={levelLoaded}
            streak={streak}
            recent={days.status === "ready" ? insights.recent : null}
        />
    );

    if (days.status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="Insights didn’t load" onRetry={days.retry} />
                </DayLayout>
            </Page>
        );
    }

    if (days.status === "loading") {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading insights
                </p>
                <DayLayout aside={aside}>
                    {header}
                    <InsightsSkeleton />
                </DayLayout>
            </Page>
        );
    }

    if (insights.empty) {
        return (
            <Page>
                <DayLayout aside={aside}>
                    {header}
                    <EmptyState
                        className={styles.state}
                        title={NOTHING_YET.insights.title}
                        actions={
                            <Button as={Link} to={HOME_PATH} variant="primary">
                                Go to Today
                            </Button>
                        }
                    >
                        {NOTHING_YET.insights.body}
                    </EmptyState>
                </DayLayout>
            </Page>
        );
    }

    const words = weekWords({ thisWeek: insights.weeks[0], lastWeek: insights.weeks[1] ?? null });

    return (
        <Page>
            <DayLayout aside={aside}>
                {header}
                <p className={styles.summary}>
                    <b>{words.lead}</b> {words.rest}
                </p>
                <WeekRows weeks={insights.weeks} today={today} firstDay={firstDay} />
                {insights.months.length > 1 && <MonthRows months={insights.months} today={today} />}
                <ItemRanks ranks={ranks} status={items.status} onRetry={items.retry} />
                <Ledger key={account} account={account} today={today} totalXp={levelLoaded ? levelInfo.totalXp : null} />
            </DayLayout>
        </Page>
    );
};

export default InsightsPage;
