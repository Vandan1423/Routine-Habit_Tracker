import { useId } from "react";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import { cx } from "../../lib/cx";
import styles from "./Field.module.css";

/**
 * A text field of several lines. It starts `rows` lines tall and grows with what is typed, up to `maxRows`.
 * label, hint and error work as they do on Input. Every other prop goes to the <textarea> itself.
 */
const Textarea = ({ label, hint, error, rows = 3, maxRows = 8, id, className, disabled, ...rest }) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
        <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
            <label
                className={cx(styles.control, styles.textareaControl)}
                data-invalid={error ? "" : undefined}
                data-disabled={disabled ? "" : undefined}
            >
                <textarea
                    id={fieldId}
                    className={styles.textarea}
                    style={{ "--rows": rows, "--max-rows": maxRows }}
                    rows={rows}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(fieldId, { hint, error })}
                    {...rest}
                />
            </label>
        </Field>
    );
};

export default Textarea;
