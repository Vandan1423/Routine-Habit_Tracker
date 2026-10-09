import { cx } from "../../lib/cx";
import styles from "./Field.module.css";

/**
 * The frame around a form control: its label above, and a hint or an error below.
 * Input and Textarea use it; a new kind of control should too, so every field lines up.
 * An error replaces nothing: the hint stays, and the error opens beneath it.
 * labelAs: for a control that is not a native input: an element of its own (see Select), or "span" for a
 *          group of controls, which then points at the label with aria-labelledby (see WeekdayPicker).
 */
const Field = ({ id, label, labelAs: Label = "label", hint, error, className, children }) => (
    <div className={cx(styles.field, className)}>
        {label && (
            <Label
                className={styles.label}
                id={`${id}-label`}
                htmlFor={Label === "label" ? id : undefined}
            >
                {label}
            </Label>
        )}
        {children}
        {hint && (
            <p className={styles.hint} id={`${id}-hint`}>
                {hint}
            </p>
        )}
        {/* Always present, so the message can open and close smoothly and is announced when it appears */}
        <div className={styles.errorSlot} data-open={error ? "" : undefined} aria-live="polite">
            <div className={styles.errorClip}>
                <p className={styles.error} id={`${id}-error`}>
                    {error}
                </p>
            </div>
        </div>
    </div>
);

export default Field;
