import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { MiniStrip } from "./DayStrip";
import Button from "../ui/Button";
import styles from "./DayRecap.module.css";

const numberFormat = new Intl.NumberFormat();
// A real minus sign, as wide as the plus on a gain
const lost = (amount) => `−${numberFormat.format(amount)}`;

/**
 * What was settled when a day closed: how it ended, what was left open, and what that cost.
 * Said once and plainly, at the top of the next day, and put away with one press. The loss is the only
 * thing on Today set in the colour of a loss.
 *
 * recap: from buildRecap (lib/recap.js): { label, text, loss, rows }, or null for nothing to report.
 *        rows holds one line per day when several days closed since the last visit.
 * onDismiss: "Dismiss" was pressed
 */
const DayRecap = ({ recap, onDismiss }) => (
    <AnimatePresence initial={false}>
        {recap && (
            <m.div key="recap" className={styles.frame} exit={{ height: 0, opacity: 0 }}>
                <section className={styles.recap} aria-label="Recap">
                    <header className={styles.head}>
                        <h2 className={styles.label}>{recap.label}</h2>
                        <Button variant="ghost" size="sm" className={styles.dismiss} onClick={onDismiss}>
                            Dismiss
                        </Button>
                    </header>
                    <div className={styles.body}>
                        <p className={styles.text}>{recap.text}</p>
                        {recap.loss > 0 && (
                            <p className={styles.loss}>{lost(recap.loss)}&nbsp;XP</p>
                        )}
                    </div>
                    {recap.rows.length > 0 && (
                        <ul className={styles.days}>
                            {recap.rows.map((row) => (
                                <li key={row.date} className={styles.day}>
                                    <span>{row.label}</span>
                                    <MiniStrip total={row.total} done={row.done} settled />
                                    <span className={styles.count}>
                                        {row.total > 0 ? `${row.done}/${row.total}` : ""}
                                    </span>
                                    <span className={styles.cost}>
                                        {row.loss > 0 ? lost(row.loss) : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </m.div>
        )}
    </AnimatePresence>
);

export default DayRecap;
