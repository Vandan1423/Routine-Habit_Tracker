import Icon from "./Icon";
import { cx } from "../../lib/cx";
import styles from "./Stepper.module.css";

/**
 * Two joined buttons that take a count down or up by one step: glasses of water, pages read.
 * It only asks for a change; whoever holds the count decides what a step is worth.
 *
 * onStep: called with -1 or 1
 * label: what is being counted ("Drink water"), for screen readers
 * canDecrease, canIncrease: false at the ends of the range
 */
const Stepper = ({ onStep, label, canDecrease = true, canIncrease = true, className }) => (
    <span className={cx(styles.stepper, className)} role="group" aria-label={label}>
        <button
            type="button"
            className={styles.button}
            aria-label={label ? `Less: ${label}` : "Less"}
            disabled={!canDecrease}
            data-step="-1"
            onClick={() => onStep(-1)}
        >
            <Icon name="minus" />
        </button>
        <button
            type="button"
            className={styles.button}
            aria-label={label ? `More: ${label}` : "More"}
            disabled={!canIncrease}
            data-step="1"
            onClick={() => onStep(1)}
        >
            <Icon name="plus" />
        </button>
    </span>
);

export default Stepper;
