import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import DayView from "./DayView";
import MonthView from "./MonthView";
import { HISTORY_PATH } from "./historyPaths";
import { DaySkeleton } from "../../components/day";
import { HOME_PATH } from "../../components/shell/navigation";
import Page from "../../components/shell/Page";
import useToday from "../../hooks/useToday";
import { addDays, isDay, isMonth, localDay, monthOf } from "../../lib/dates";

/**
 * History: the days that have ended. The address says what is on show: a month as a calendar of small
 * day strips ("/history/2026-10", or the month today is in when nothing is given), or one day of it,
 * read-only, drawn with the pieces Today is made of ("/history/2026-10-03").
 */
const HistoryPage = () => {
    const { when } = useParams();
    const { date, status, ensure } = useToday();

    // Today's own tally is drawn on the calendar too, and only Today's lists know it
    useEffect(() => {
        ensure();
    }, [ensure]);

    const today = date ?? localDay();

    if (isDay(when)) {
        // The account's day can differ from this device's by one. Until it is known, a date that close
        // to the device's today could be yesterday, today or tomorrow: wait rather than guess.
        const waiting = date === null && (status === "idle" || status === "loading");
        if (waiting && when >= addDays(today, -1)) {
            return (
                <Page>
                    <p className="visually-hidden" role="status">
                        Loading the day
                    </p>
                    <DaySkeleton />
                </Page>
            );
        }

        // Today is still open: it has its own screen. A day still to come has nothing to show.
        if (when === today) return <Navigate to={HOME_PATH} replace />;
        if (when > today) return <Navigate to={HISTORY_PATH} replace />;

        return <DayView date={when} today={today} />;
    }

    if (when !== undefined && !(isMonth(when) && when <= monthOf(today))) {
        return <Navigate to={HISTORY_PATH} replace />;
    }

    return <MonthView month={when ?? monthOf(today)} today={today} />;
};

export default HistoryPage;
