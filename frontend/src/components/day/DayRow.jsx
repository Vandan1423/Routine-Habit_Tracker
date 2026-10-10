import { useId } from "react";
import { Link } from "react-router-dom";
import Checkbox, { CheckMark } from "../ui/Checkbox";
import Stepper from "../ui/Stepper";
import useMoment from "../../hooks/useMoment";
import { cx } from "../../lib/cx";
import { namelessWords, pastFlagWords, pastStatusWords, signedXp } from "../../lib/historyWords";
import { formatTimeRange } from "../../lib/time";
import styles from "./DayRow.module.css";

const NBSP = " ";
const amountFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const xpFormat = new Intl.NumberFormat();

// What is written beside the title: the time for a routine, how far a counted habit has got
const metaOf = (item) => {
    if (item.kind === "routine") return formatTimeRange(item.start, item.end);
    if (!item.counted) return "";

    const unit = item.unit ? `${NBSP}${item.unit}` : "";
    return `${amountFormat.format(item.quantity)} of ${amountFormat.format(item.target)}${unit}`;
};

// The word that follows it: for something whose time has gone by, and for the one item to turn to
const flagOf = (item, next) => {
    if (item.late) return { text: "Late", tone: styles.late };
    if (!next || item.done) return null;
    if (next.state === "now") return { text: "Now", tone: styles.now };
    if (next.state === "soon") return { text: `in ${next.inMinutes}${NBSP}min`, tone: styles.now };
    return { text: "Next", tone: styles.now };
};

// As long as the spring runs (--t-spring), and a little over
const LAND_MS = 560;

/**
 * One thing on a day that is over: how it stood when the day closed, its name, and what it paid or cost.
 * Nothing here can be changed, so there is no check to press, no stepper and no menu.
 *
 * item: from buildPastDay (lib/history.js)
 * to: where its name leads (its own page), if it is still in the plan
 */
export const PastDayRow = ({ item, to }) => {
    // A count that never started has nothing to say beyond "Missed"
    const meta = item.status === "missed" && item.counted ? "" : metaOf(item);
    const flag = pastFlagWords(item);
    const title = item.title ?? namelessWords(item.kind);

    return (
        <li className={cx(styles.row, styles.past, item.done && styles.done)} data-item={item.key}>
            <CheckMark checked={item.done} progress={item.counted ? item.progress : 0} missed={!item.done} />
            <div className={styles.main}>
                <span className="visually-hidden">{pastStatusWords(item)}: </span>
                {to ? (
                    <Link to={to} className={cx(styles.title, styles.link)}>
                        {title}
                    </Link>
                ) : (
                    // Reachable with J and K like the rows beside it, though there is nowhere for it to lead
                    <span className={styles.title} tabIndex={-1}>
                        {title}
                    </span>
                )}
                {(meta || flag) && (
                    <span className={styles.meta}>
                        {meta}
                        {meta && flag && " · "}
                        {flag && <b className={flag.tone === "late" ? styles.late : undefined}>{flag.text}</b>}
                    </span>
                )}
            </div>
            <span className={cx(styles.xp, item.lost > 0 && styles.lost)}>
                {item.done ? signedXp(item.xp) : item.lost > 0 ? signedXp(-item.lost) : ""}
                {(item.done || item.lost > 0) && <span className="visually-hidden"> XP</span>}
            </span>
        </li>
    );
};

/**
 * One thing to do today: the check that completes it, its name, a line of detail, and what it is worth.
 * Completing it is one gesture: the check is drawn, the name settles to quieter ink, and what it was worth
 * lands as what it paid.
 *
 * item: from buildDay (lib/day.js). One that is `saving` is on its way to the server: it is shown as it
 *       will be, and its check and stepper wait until the server has it.
 * next: set on the one item to turn to ({ state, inMinutes }); it gets the saffron ring and word
 * onCheck(item, checked): the check was ticked or un-ticked
 * onStep(item, direction): a counted habit's stepper was pressed, -1 or 1
 * menu: what opens from the row's "more" button, if anything
 */
const DayRow = ({ item, next, onCheck, onStep, menu }) => {
    const metaId = useId();
    const meta = metaOf(item);
    const flag = flagOf(item, next);
    const detailed = Boolean(meta || flag);
    const landing = useMoment(item.done, LAND_MS);

    return (
        <li
            className={cx(styles.row, item.done && styles.done, landing && styles.landing)}
            data-item={item.key}
        >
            <Checkbox
                checked={item.done}
                progress={item.counted ? item.progress : 0}
                tone={next && !item.done ? "next" : undefined}
                onChange={(event) => {
                    if (!item.saving) onCheck(item, event.target.checked);
                }}
                aria-label={item.title}
                aria-disabled={item.saving || undefined}
                aria-describedby={detailed ? metaId : undefined}
            />
            <div className={styles.main}>
                <span className={styles.title}>{item.title}</span>
                {detailed && (
                    <span id={metaId} className={styles.meta}>
                        {meta}
                        {meta && flag && " · "}
                        {flag && <b className={flag.tone}>{flag.text}</b>}
                    </span>
                )}
            </div>
            {menu && <span className={styles.menu}>{menu}</span>}
            {/* Once the target is reached the stepper has nothing left to do; un-ticking brings it back */}
            {item.counted && !item.done && !item.saving && (
                <Stepper
                    label={item.title}
                    canDecrease={item.quantity > 0}
                    onStep={(direction) => onStep(item, direction)}
                />
            )}
            <span className={styles.xp}>
                +{xpFormat.format(item.xp)}
                <span className="visually-hidden"> XP</span>
            </span>
        </li>
    );
};

export default DayRow;
