import { useId } from "react";
import Icon from "./Icon";
import { cx } from "../../lib/cx";
import styles from "./SegmentedControl.module.css";

/**
 * A choice of one among a few, all visible at once. Underneath it is a group of radio buttons,
 * so the arrow keys move between the options.
 * options: [{ value, label, icon }]. `label` is always needed; `iconOnly` shows just the icons and keeps the labels for screen readers.
 * value, onChange(value): the chosen option
 * label: what the choice is about, for screen readers
 */
const SegmentedControl = ({
    options,
    value,
    onChange,
    label,
    iconOnly = false,
    disabled = false,
    className,
}) => {
    const name = useId();
    const chosen = options.findIndex((option) => option.value === value);

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cx(styles.group, className)}
            style={{ "--count": options.length, "--chosen": Math.max(chosen, 0) }}
        >
            {chosen >= 0 && <span className={styles.thumb} aria-hidden="true" />}
            {options.map((option) => (
                <label key={option.value} className={styles.segment}>
                    <input
                        type="radio"
                        className={styles.input}
                        name={name}
                        value={option.value}
                        checked={option.value === value}
                        disabled={disabled}
                        onChange={() => onChange(option.value)}
                    />
                    <span className={styles.text}>
                        {option.icon && <Icon name={option.icon} />}
                        <span className={iconOnly ? "visually-hidden" : undefined}>
                            {option.label}
                        </span>
                    </span>
                </label>
            ))}
        </div>
    );
};

export default SegmentedControl;
