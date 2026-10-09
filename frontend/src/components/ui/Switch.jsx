import { cx } from "../../lib/cx";
import styles from "./Switch.module.css";

/**
 * An on/off setting that takes effect at once. (For something that is confirmed later, use a Checkbox.)
 * label: text beside the switch. Without one, pass aria-label.
 * Every other prop (checked, onChange, disabled…) goes to the <input> itself.
 */
const Switch = ({ label, className, ...rest }) => (
    <label className={cx(styles.switch, className)}>
        <span className={styles.control}>
            <input type="checkbox" role="switch" className={styles.input} {...rest} />
            <span className={styles.track} aria-hidden="true">
                <span className={styles.thumb} />
            </span>
        </span>
        {label && <span className={styles.label}>{label}</span>}
    </label>
);

export default Switch;
