import { Link } from "react-router-dom";
import { ProgressBar, SectionHeader } from "../../components/ui";
import { cx } from "../../lib/cx";
import { formatMonth, formatMonthName, monthOf } from "../../lib/dates";
import { signedXp, spanWords } from "../../lib/historyWords";
import { monthPath } from "../History/historyPaths";
import styles from "./InsightsPage.module.css";

/**
 * The months, newest first: how much of what each asked was done, drawn as one bar, and the XP it netted.
 * A month's name leads to it in History.
 *
 * months: from buildInsights (lib/insights.js). today: "YYYY-MM-DD"
 */
const MonthRows = ({ months, today }) => {
    const thisYear = today.slice(0, 4);

    return (
        <section className={styles.section} aria-label="Month by month">
            <SectionHeader className={styles.head} title="Month by month" />
            <ul>
                {months.map((entry) => (
                    <li key={entry.month} className={styles.monthRow}>
                        <Link to={monthPath(entry.month)} className={styles.name}>
                            {entry.month.startsWith(thisYear) ? formatMonthName(entry.month) : formatMonth(entry.month)}
                            {entry.month === monthOf(today) && (
                                <>
                                    {/* Read out with the name; the gap between them is drawn by the row */}{" "}
                                    <span className={styles.aside}>so far</span>
                                </>
                            )}
                            <span className="visually-hidden">: {spanWords(entry)}</span>
                        </Link>
                        <ProgressBar className={styles.bar} size="md" value={entry.done} max={entry.total || 1} />
                        <span className={styles.figureCell} aria-hidden="true">
                            {entry.share === null ? "" : `${Math.round(entry.share * 100)}%`}
                        </span>
                        <span className={cx(styles.figureCell, entry.net < 0 && styles.loss)}>
                            {signedXp(entry.net)}
                            <span className="visually-hidden"> XP</span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default MonthRows;
