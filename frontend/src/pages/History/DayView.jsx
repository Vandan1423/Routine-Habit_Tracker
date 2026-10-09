import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import WeekNav from "./WeekNav";
import { dayPath, monthPath } from "./historyPaths";
import { DayBlock, DayBodySkeleton, DayHeader, DayLayout, DayProgress, DayTotal } from "../../components/day";
import { HOME_PATH } from "../../components/shell/navigation";
import Page from "../../components/shell/Page";
import { Button, EmptyState, ErrorState, Icon, IconButton } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useHotkeys from "../../hooks/useHotkeys";
import useListKeys from "../../hooks/useListKeys";
import useNow from "../../hooks/useNow";
import useToday from "../../hooks/useToday";
import { addDays, formatDayTitle, formatMonth, monthOf, weekOf } from "../../lib/dates";
import { buildDay } from "../../lib/day";
import { buildPastDay } from "../../lib/history";
import { NO_RECORD_WORDS, pastDayWords, pastTotalLabel, unnamedWords } from "../../lib/historyWords";
import { KEYS } from "../../lib/shortcuts";
import historyService from "../../services/historyService";
import { itemPath } from "../Plan/planPaths";
import styles from "./HistoryPage.module.css";

/**
 * One day that has ended, as it stood when it closed: the same list Today is, with nothing on it to press.
 * What was done is ticked and shows what it paid; what was left is outlined and shows what it cost.
 * The days either side are a press (or an arrow key) away.
 *
 * date: the day on show. today: "YYYY-MM-DD"
 */
const DayView = ({ date, today }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { status: todayStatus, routines, habits } = useToday();
    const now = useNow();

    const account = user?._id ?? user?.id ?? user?.email ?? "account";
    const detail = useFetched(`day:${account}:${date}`, () => historyService.getDay(date));

    const week = weekOf(date);
    const weekDays = useFetched(`days:${account}:${week[0]}:${week[6]}`, () =>
        historyService.getDays(week[0], week[6]),
    );

    const day = useMemo(() => (detail.data ? buildPastDay(detail.data) : null), [detail.data]);

    // Today as it stands, if it is one of the week's days
    const showsToday = week.includes(today);
    const live = useMemo(() => {
        if (todayStatus !== "ready" || !showsToday) return null;

        const built = buildDay({ routines, habits, now });
        return { total: built.total, done: built.done };
    }, [todayStatus, showsToday, routines, habits, now]);

    // The first day on record is as far back as there is anything to turn to
    const since = detail.data?.since ?? weekDays.data?.since ?? null;
    const earlier = addDays(date, -1);
    const later = addDays(date, 1);
    const canGoBack = Boolean(since) && earlier >= since;

    const goBack = () => navigate(dayPath(earlier));
    // The day after yesterday is today, which is shown on its own screen
    const goOn = () => navigate(later === today ? HOME_PATH : dayPath(later));

    useHotkeys({
        [KEYS.earlier]: () => (canGoBack ? goBack() : false),
        [KEYS.later]: goOn,
    });
    // J and K walk the rows; a row's name is a link, so Enter opens it
    useListKeys();

    const month = monthOf(date);
    const words = day?.recorded ? pastDayWords(day) : null;

    return (
        <Page>
            <DayLayout
                aside={<WeekNav date={date} today={today} summaries={weekDays.data?.days} live={live} />}
            >
                <DayHeader
                    eyebrow={
                        <Link to={monthPath(month)} className={styles.back}>
                            <Icon name="arrow-left" size={14} />
                            {formatMonth(month)}
                        </Link>
                    }
                    title={formatDayTitle(date)}
                    action={
                        <div className={styles.turn}>
                            <IconButton
                                icon="chevron-left"
                                variant="secondary"
                                label="The day before"
                                disabled={!canGoBack}
                                onClick={goBack}
                            />
                            <IconButton
                                icon="chevron-right"
                                variant="secondary"
                                label={later === today ? "Today" : "The day after"}
                                onClick={goOn}
                            />
                        </div>
                    }
                />

                {detail.status === "error" && (
                    <ErrorState className={styles.state} title="This day didn’t load" onRetry={detail.retry} />
                )}

                {detail.status === "loading" && (
                    <>
                        <p className="visually-hidden" role="status">
                            Loading the day
                        </p>
                        <DayBodySkeleton />
                    </>
                )}

                {day && !day.recorded && (
                    <EmptyState
                        className={styles.state}
                        segments={0}
                        title={NO_RECORD_WORDS.title}
                        actions={
                            <Button as={Link} to={monthPath(month)}>
                                Back to {formatMonth(month)}
                            </Button>
                        }
                    >
                        {NO_RECORD_WORDS.body}
                    </EmptyState>
                )}

                {day?.recorded && (
                    <>
                        <DayProgress
                            message={words}
                            done={day.done}
                            total={day.total}
                            blocks={day.blocks}
                            settled
                        />
                        {day.blocks.map((block) => (
                            <DayBlock
                                key={block.id}
                                block={block}
                                past
                                linkTo={(item) => (item.active ? itemPath(item) : null)}
                            />
                        ))}
                        {day.unnamed > 0 && (
                            <p className={styles.unnamed}>{unnamedWords(day.unnamed, day.items.length === 0)}</p>
                        )}
                        {(day.items.length > 0 || day.bonus > 0) && (
                            <DayTotal
                                earned={day.earned}
                                bonus={day.bonus}
                                lost={day.lost}
                                label={pastTotalLabel(day)}
                            />
                        )}
                    </>
                )}
            </DayLayout>
        </Page>
    );
};

export default DayView;
