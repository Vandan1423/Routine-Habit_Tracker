import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import DayStrip from "./DayStrip";
import AnimatedNumber from "../ui/AnimatedNumber";
import { BONUS_LABEL } from "../../lib/dayMessage";
import styles from "./DayProgress.module.css";

const numberFormat = new Intl.NumberFormat();

/**
 * How the day stands: a sentence, the count, and the Day Strip under them.
 * message: { lead, rest } from lib/dayMessage.js; the lead is set with more weight
 * done, total: the count ("7 of 12")
 * blocks: the day's parts, for the strip
 * settled: the day is over (see DayStrip)
 */
export const DayProgress = ({ message, done, total, blocks, settled = false }) => (
    <div className={styles.progress}>
        <div className={styles.top}>
            {/* Read out when it changes: it is the answer to "what did that tick do?" */}
            <p className={styles.message} aria-live="polite">
                {message && (
                    <>
                        <b>{message.lead}</b> {message.rest}
                    </>
                )}
            </p>
            <p className={styles.count}>
                <b>
                    <AnimatedNumber value={done} />
                </b>{" "}
                of {numberFormat.format(total)}
            </p>
        </div>
        <DayStrip blocks={blocks} settled={settled} className={styles.strip} />
    </div>
);

// A real minus sign, as wide as the plus
const signed = (value) => `${value < 0 ? "−" : "+"}${numberFormat.format(Math.abs(value))}`;

// A line that takes its place in the total, and gives it up, by opening and closing its own height
const LINE = {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto", opacity: 1 },
    exit: { height: 0, opacity: 0 },
};

/**
 * The foot of the day's list: the XP column added up.
 * earned: what the rows above have paid
 * bonus: what the day itself has been paid for having everything done. It gets a line of its own,
 *        since no row shows it, and is part of the total.
 * lost: what the day was charged for things left undone, once it has closed. It gets a line too,
 *       in the colour of a loss, and is taken off the total; what the rows paid is then written out
 *       above it, so the lines can be seen to add up. lostLabel names the loss.
 * note: a closing line under the total, such as where tomorrow starts
 * label: "Earned today" unless given
 */
export const DayTotal = ({ earned, bonus = 0, lost = 0, lostLabel = "Left open", note, label = "Earned today" }) => (
    <div className={styles.total}>
        {lost > 0 && (
            <p className={styles.entry}>
                <span>Earned</span>
                <span>{signed(earned)}</span>
            </p>
        )}
        <AnimatePresence initial={false}>
            {bonus > 0 && (
                <m.p key="bonus" className={styles.line} {...LINE}>
                    <span className={styles.entry}>
                        <span>{BONUS_LABEL}</span>
                        <span>{signed(bonus)}</span>
                    </span>
                </m.p>
            )}
        </AnimatePresence>
        {lost > 0 && (
            <p className={styles.entry}>
                <span>{lostLabel}</span>
                <span className={styles.lost}>{signed(-lost)}</span>
            </p>
        )}
        <p className={styles.sum}>
            <span>{label}</span>
            <span>
                <b>
                    <AnimatedNumber value={earned + bonus - lost} format={signed} />
                </b>
                &nbsp;XP
            </span>
        </p>
        <AnimatePresence initial={false}>
            {note && (
                <m.p key="note" className={styles.line} {...LINE}>
                    <span className={styles.note}>{note}</span>
                </m.p>
            )}
        </AnimatePresence>
    </div>
);

export default DayProgress;
