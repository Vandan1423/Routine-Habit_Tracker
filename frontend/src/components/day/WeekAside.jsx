import { MiniStrip } from "./DayStrip";
import AnimatedNumber from "../ui/AnimatedNumber";
import { cx } from "../../lib/cx";
import { weekOf, weekdayOf } from "../../lib/dates";
import { tallyOf } from "../../lib/day";
import { streakNote } from "../../lib/dayMessage";
import { weekdayName } from "../../lib/week";
import styles from "./WeekAside.module.css";

// What a day of the week has to show: nothing for a day still to come or one with no record
const dayRow = (day, date, summaries, today) => {
    if (day === date) return { ...today, settled: false };
    if (day > date) return null;

    const tally = tallyOf(summaries.find((entry) => entry.date === day));
    return tally && tally.total > 0 ? { total: tally.total, done: tally.done, settled: true } : null;
};

/**
 * Beside the day: the week so far, a short strip for each day, and the streak.
 *
 * date: today, "YYYY-MM-DD"
 * summaries: the recent daily summaries from the API (date, totals and completions)
 * today: { total, done } as it stands right now, which no stored summary can know
 * streak: { current, best }, or null if it could not be fetched; the section is then left out
 */
const WeekAside = ({ date, summaries = [], today, streak }) => (
    <>
        <section>
            <h2 className={styles.heading}>This week</h2>
            <ul className={styles.week}>
                {weekOf(date).map((day) => {
                    const row = dayRow(day, date, summaries, today);
                    const weekday = weekdayOf(day);

                    return (
                        <li key={day} className={cx(styles.day, day === date && styles.today)}>
                            <span aria-hidden="true">{weekdayName(weekday, "short")}</span>
                            <span className="visually-hidden">{weekdayName(weekday)}</span>
                            <MiniStrip total={row?.total} done={row?.done} settled={row?.settled} />
                            <span className={styles.count}>
                                {row && row.total > 0 ? `${row.done}/${row.total}` : ""}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
        {streak && (
            <section>
                <h2 className={styles.heading}>Streak</h2>
                <p className={styles.figure}>
                    <AnimatedNumber value={streak.current} />{" "}
                    <small>{streak.current === 1 ? "day" : "days"}</small>
                </p>
                <p className={styles.note}>{streakNote(streak.current, streak.best)}</p>
            </section>
        )}
    </>
);

export default WeekAside;
