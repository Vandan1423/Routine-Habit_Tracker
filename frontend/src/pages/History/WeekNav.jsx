import { Link } from "react-router-dom";
import { dayPath } from "./historyPaths";
import { MiniStrip } from "../../components/day";
import { HOME_PATH } from "../../components/shell/navigation";
import { weekdayOf, weekOf } from "../../lib/dates";
import { tallyOf } from "../../lib/day";
import { weekdayName } from "../../lib/week";
import styles from "./HistoryPage.module.css";

/**
 * Beside an ended day: the week it belongs to, a short strip for each day. A day leads to itself,
 * so the week can be walked without going back to the month.
 *
 * date: the day on show. today: "YYYY-MM-DD"
 * summaries: the week's day summaries, as far as they are known
 * live: { total, done } as today stands, if today is in this week
 */
const WeekNav = ({ date, today, summaries = [], live }) => (
    <section>
        <h2 className={styles.heading}>That week</h2>
        <ul className={styles.week}>
            {weekOf(date).map((day) => {
                const weekday = weekdayOf(day);
                const tally = day === today ? live : day < today ? tallyOf(summaries.find((entry) => entry.date === day)) : null;
                const inside = (
                    <>
                        <span aria-hidden="true">{weekdayName(weekday, "short")}</span>
                        <span className="visually-hidden">{weekdayName(weekday)}</span>
                        <MiniStrip total={tally?.total} done={tally?.done} settled={day < today} />
                        <span className={styles.count}>
                            {tally && tally.total > 0 ? `${tally.done}/${tally.total}` : ""}
                        </span>
                    </>
                );

                return (
                    <li key={day}>
                        {day > today ? (
                            <span className={styles.weekDay}>{inside}</span>
                        ) : (
                            <Link
                                to={day === today ? HOME_PATH : dayPath(day)}
                                className={styles.weekDay}
                                aria-current={day === date ? "page" : undefined}
                            >
                                {inside}
                            </Link>
                        )}
                    </li>
                );
            })}
        </ul>
    </section>
);

export default WeekNav;
