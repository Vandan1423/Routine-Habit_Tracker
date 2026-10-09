import { Link } from "react-router-dom";
import { MiniStrip } from "../../components/day";
import { SectionHeader } from "../../components/ui";
import useMediaQuery from "../../hooks/useMediaQuery";
import { cx } from "../../lib/cx";
import { monthOf } from "../../lib/dates";
import { spanWords, weekLabel, WEEKS_NOTE } from "../../lib/historyWords";
import { weekdayName, weekOrder } from "../../lib/week";
import { monthPath } from "../History/historyPaths";
import styles from "./InsightsPage.module.css";

/**
 * The weeks, newest first: each one a row of seven day strips, the same small mark Today's aside and
 * History's calendar use, with what the week came to at the end of the row. A week's name leads to its
 * month in History.
 *
 * weeks: from buildInsights (lib/insights.js). today: "YYYY-MM-DD". firstDay: where the reader's week starts
 */
const WeekRows = ({ weeks, today, firstDay }) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const thisWeekStart = weeks[0]?.start;

    return (
        <section className={styles.section} aria-label="Week by week">
            <SectionHeader className={styles.head} title="Week by week" />
            <div className={cx(styles.weekRow, styles.weekdays)} aria-hidden="true">
                <span />
                {weekOrder(firstDay).map((day) => (
                    <span key={day}>{weekdayName(day, "short").slice(0, isPhone ? 1 : 2)}</span>
                ))}
                <span />
            </div>
            <ul>
                {weeks.map((week) => (
                    <li key={week.start} className={styles.weekRow}>
                        <Link
                            to={monthPath(monthOf(week.start < today ? week.start : today))}
                            className={styles.name}
                        >
                            {weekLabel(week.start, thisWeekStart)}
                            <span className="visually-hidden">: {spanWords(week)}</span>
                        </Link>
                        {week.cells.map((cell, index) => (
                            <MiniStrip
                                key={index}
                                total={cell?.total}
                                done={cell?.done}
                                settled={cell?.settled}
                                whole={isPhone}
                            />
                        ))}
                        <span className={styles.figureCell} aria-hidden="true">
                            {week.total > 0 ? `${week.done}/${week.total}` : ""}
                        </span>
                    </li>
                ))}
            </ul>
            <p className={styles.caption}>{WEEKS_NOTE}</p>
        </section>
    );
};

export default WeekRows;
