import { MiniStrip } from "../../components/day";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { weekDayWords, weekStandingWords } from "../../lib/itemWords";
import { weekdayName } from "../../lib/week";
import styles from "./PlanWeek.module.css";

const numberFormat = new Intl.NumberFormat();

// What a day's count says: what got done of what it asked, or for a day to come, what it will ask
const countOf = (day) => {
    if (day.when === "ahead") return day.total > 0 ? numberFormat.format(day.total) : "";
    return day.total > 0 ? `${numberFormat.format(day.done)}/${numberFormat.format(day.total)}` : "–";
};

/**
 * The week today is in, as Today draws it: a day that has ended by how it went (what got done, and what
 * was missed, outlined in the colour of a loss), today as it stands, and a day still to come by how much
 * the plan asks of it, one-off tasks dated that day included. Pressing a day shows that day alone;
 * pressing it again shows the whole plan.
 *
 * standing: from weekStanding, its days in reading order
 * selected: the day being shown ("YYYY-MM-DD"), or null. onSelect(date | null)
 * layout: "column" beside the list (a row for each day, with a strip and the week's tally under them),
 *         or "row" above it (seven cells)
 */
const PlanWeek = ({ standing, selected, onSelect, layout = "column" }) => {
    const { days } = standing;
    // The fullest day's strip runs the whole width; the others are as long as they are full
    const most = Math.max(...days.map((day) => day.total), 1);
    const words = layout === "column" ? weekStandingWords(standing) : [];

    return (
        <section className={cx(styles.week, styles[layout])} aria-label="This week">
            {layout === "column" && <h2 className={styles.heading}>This week</h2>}
            <ul className={styles.days}>
                {days.map((day) => (
                    <li key={day.date}>
                        <button
                            type="button"
                            className={cx(
                                styles.day,
                                day.when === "today" && styles.today,
                                day.when === "ahead" && styles.ahead,
                            )}
                            aria-pressed={day.date === selected}
                            aria-current={day.when === "today" ? "date" : undefined}
                            onClick={() => onSelect(day.date === selected ? null : day.date)}
                        >
                            <span aria-hidden="true">{weekdayName(day.day, "short")}</span>
                            <span className="visually-hidden">
                                {formatDayPlain(day.date)}
                                {day.when === "today" ? ", today" : ""}, {weekDayWords(day)}
                            </span>
                            {layout === "column" && (
                                <span className={styles.load} style={{ width: `${(day.total / most) * 100}%` }}>
                                    <MiniStrip total={day.total} done={day.done} settled={day.when === "past"} />
                                </span>
                            )}
                            <span className={styles.count} aria-hidden="true">
                                {countOf(day)}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {words.length > 0 && (
                <div className={styles.tally}>
                    {words.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </div>
            )}
        </section>
    );
};

export default PlanWeek;
