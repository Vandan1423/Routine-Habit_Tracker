import { useEffect, useRef } from "react";
import useMoment from "../../hooks/useMoment";
import { cx } from "../../lib/cx";
import styles from "./Checkbox.module.css";

/**
 * The check that completes things. Underneath it is a real checkbox, so the keyboard, forms
 * and screen readers treat it as one.
 * Ticking it is one small gesture: the box fills with ink and settles, and the tick is drawn like a pen stroke.
 * progress: 0 to 1, how far a counted habit has got. While unchecked, the box fills from the bottom to show it.
 * tone: "next" rings the box in saffron, for the one item that is up next.
 * label: text beside the box. Without one, pass aria-label.
 * Every other prop (checked, onChange, disabled…) goes to the <input> itself.
 */
// As long as the spring runs (--t-spring), and a little over
const SETTLE_MS = 560;

const Checkbox = ({ checked = false, progress = 0, tone, label, className, ...rest }) => {
    const inputRef = useRef(null);
    const partly = !checked && progress > 0;
    // Only when it becomes ticked while on screen, never for a box that is drawn already ticked
    const settling = useMoment(checked, SETTLE_MS);

    // "Partly done" has no HTML attribute. It can only be set on the element.
    useEffect(() => {
        inputRef.current.indeterminate = partly;
    }, [partly]);

    return (
        <label
            className={cx(
                styles.checkbox,
                tone === "next" && styles.next,
                settling && styles.settling,
                className,
            )}
        >
            <span className={styles.control}>
                <input
                    ref={inputRef}
                    type="checkbox"
                    className={styles.input}
                    checked={checked}
                    {...rest}
                />
                <span className={styles.box} aria-hidden="true">
                    <span
                        className={styles.fill}
                        style={{ height: `${partly ? Math.min(progress, 1) * 100 : 0}%` }}
                    />
                    <svg className={styles.tick} viewBox="0 0 18 18">
                        <path d="M4.6 9.4l2.9 2.9 6-6.4" />
                    </svg>
                </span>
            </span>
            {label && <span className={styles.label}>{label}</span>}
        </label>
    );
};

/**
 * The same box as a drawing, for a day that is over: ticked for what was done, part filled for a count that
 * fell short, and outlined in the colour of a loss for what was left. There is nothing to press, so it is
 * not a checkbox to the keyboard or to screen readers; say in words beside it what it shows.
 * checked, progress: as on Checkbox. missed: left undone when the day closed.
 */
export const CheckMark = ({ checked = false, progress = 0, missed = false, className }) => {
    const partly = !checked && progress > 0;

    return (
        <span
            className={cx(styles.control, styles.mark, checked && styles.marked, missed && styles.missed, className)}
            aria-hidden="true"
        >
            <span className={styles.box}>
                <span
                    className={styles.fill}
                    style={{ height: `${partly ? Math.min(progress, 1) * 100 : 0}%` }}
                />
                <svg className={styles.tick} viewBox="0 0 18 18">
                    <path d="M4.6 9.4l2.9 2.9 6-6.4" />
                </svg>
            </span>
        </span>
    );
};

export default Checkbox;
