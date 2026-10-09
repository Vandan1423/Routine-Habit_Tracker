import { MiniStrip } from "../../components/day";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { weekdayName } from "../../lib/week";
import styles from "./PlanWeek.module.css";

/**
 * The week today is in: for each of its days, how much falls on it, one-off tasks dated that day included.
 * Pressing a day shows that day alone; pressing it again shows the whole plan.
 *
 * week: from buildPlan: [{ date, day, total, worth, once }] in reading order
 * selected: the day being shown ("YYYY-MM-DD"), or null. onSelect(date | null)
 * today: "YYYY-MM-DD"
 * layout: "column" beside the list (a row for each day, with a strip), or "row" above it (seven cells)
 */
const PlanWeek = ({ week, selected, onSelect, today, layout = "column" }) => {
    // The fullest day's strip runs the whole width; the others are as long as they are full
    const most = Math.max(...week.map((entry) => entry.total), 1);

    return (
        <section className={cx(styles.week, styles[layout])} aria-label="This week">
            {layout === "column" && <h2 className={styles.heading}>This week</h2>}
            <ul className={styles.days}>
                {week.map(({ date, day, total }) => (
                    <li key={date}>
                        <button
                            type="button"
                            className={cx(styles.day, date === today && styles.today)}
                            aria-pressed={date === selected}
                            aria-current={date === today ? "date" : undefined}
                            onClick={() => onSelect(date === selected ? null : date)}
                        >
                            <span aria-hidden="true">{weekdayName(day, "short")}</span>
                            <span className="visually-hidden">
                                {formatDayPlain(date)}
                                {date === today ? ", today" : ""}, {total} planned
                            </span>
                            {layout === "column" && (
                                <span className={styles.load} style={{ width: `${(total / most) * 100}%` }}>
                                    <MiniStrip total={total} />
                                </span>
                            )}
                            <span className={styles.count} aria-hidden="true">
                                {total}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default PlanWeek;
