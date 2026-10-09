import { useId } from "react";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import styles from "./Field.module.css";

/**
 * A single-line text field.
 * label, hint, error: the text above and below it. An error also marks the field as invalid.
 * leading: an icon name, or anything else, shown inside the box before the text
 * trailing: anything shown inside the box after the text, such as a unit ("pages")
 * Every other prop goes to the <input> itself.
 */
const Input = ({ label, hint, error, leading, trailing, id, className, disabled, ...rest }) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
        <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
            {/* A label, so a click anywhere in the box lands in the input */}
            <label
                className={styles.control}
                data-invalid={error ? "" : undefined}
                data-disabled={disabled ? "" : undefined}
            >
                {leading && (
                    <span className={styles.adornment}>
                        {typeof leading === "string" ? <Icon name={leading} /> : leading}
                    </span>
                )}
                <input
                    id={fieldId}
                    className={styles.input}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(fieldId, { hint, error })}
                    {...rest}
                />
                {trailing && <span className={styles.adornment}>{trailing}</span>}
            </label>
        </Field>
    );
};

export default Input;
