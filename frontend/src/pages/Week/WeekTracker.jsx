import { Link } from "react-router-dom";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { weekdayName } from "../../lib/week";
import { TRACK_WORDS } from "../../lib/weekWords";
import { itemPath } from "../Plan/planPaths";
import styles from "./WeekPage.module.css";

const numberFormat = new Intl.NumberFormat();

// What the marks mean, in the order they are explained under the table
const LEGEND = [
    ["done", "Done"],
    ["late", "Late"],
    ["partial", "Partly"],
    ["missed", "Missed"],
    ["open", "Still open"],
];

/**
 * The week's tracker: every routine and habit the plan asks of this week down the side, the seven days
 * across, and in each cell how it stood that day, with the same marks an item's own page uses.
 * rows: from trackerRows. days: the week's days (buildWeek)
 */
const WeekTracker = ({ rows, days }) => {
    if (rows.length === 0) return null;
    const shown = LEGEND.filter(([status]) => rows.some((row) => row.cells.some((cell) => cell.status === status)));

    return (
        <section className={styles.tracker} aria-labelledby="week-tracker">
            <h2 id="week-tracker" className={styles.heading}>
                Tracker
            </h2>
            <div className={styles.trackerScroll}>
                <table className={styles.table}>
                    <caption className="visually-hidden">How each routine and habit went on each day of the week</caption>
                    <thead>
                        <tr>
                            <th scope="col" className={styles.itemHead}>
                                <span className="visually-hidden">Routine or habit</span>
                            </th>
                            {days.map((day) => (
                                <th
                                    key={day.date}
                                    scope="col"
                                    className={cx(styles.dayCol, day.when === "today" && styles.todayCol)}
                                    aria-label={formatDayPlain(day.date)}
                                >
                                    <span>{weekdayName(day.day, "short").slice(0, 2)}</span>
                                </th>
                            ))}
                            <th scope="col" className={styles.keptHead}>
                                Kept
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.item.key}>
                                <th scope="row" className={styles.itemName}>
                                    <Link to={itemPath(row.item)}>{row.item.title}</Link>
                                </th>
                                {row.cells.map((cell, index) => (
                                    <td
                                        key={cell.date}
                                        className={cx(styles.cell, days[index].when === "today" && styles.todayCol)}
                                    >
                                        <span className={cx(styles.trackMark, styles[`track-${cell.status}`])} aria-hidden="true" />
                                        <span className="visually-hidden">{TRACK_WORDS[cell.status]}</span>
                                    </td>
                                ))}
                                <td className={styles.kept}>
                                    {row.asked > 0 ? `${numberFormat.format(row.kept)}/${numberFormat.format(row.asked)}` : "–"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {shown.length > 0 && (
                <ul className={styles.legend}>
                    {shown.map(([status, label]) => (
                        <li key={status}>
                            <span className={cx(styles.trackMark, styles[`track-${status}`])} aria-hidden="true" />
                            {label}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default WeekTracker;
