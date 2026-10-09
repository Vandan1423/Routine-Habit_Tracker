import { cx } from "../../lib/cx";
import styles from "./ProgressBar.module.css";

/**
 * A thin bar that fills from left to right, and moves smoothly when its value changes.
 * value, max: how far along
 * size: "sm" (a hairline, as under the level) or "md"
 * label: what it measures, for screen readers
 */
const ProgressBar = ({ value = 0, max = 100, size = "sm", label, className }) => {
    const share = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

    return (
        <span
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            className={cx(styles.track, styles[size], className)}
        >
            <span className={styles.bar} style={{ width: `${share * 100}%` }} />
        </span>
    );
};

export default ProgressBar;
