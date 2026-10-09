import { useId, useState } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import { weekdayName, weekOrder } from "../../lib/week";
import styles from "./WeekdayPicker.module.css";

/**
 * Which days of the week something happens on: seven toggles, any number of them on.
 * Tab reaches the group, the arrow keys move between the days, Space or Enter turns one on or off.
 * The week starts on the day the reader's own locale starts it.
 *
 * value: the chosen days as numbers, 0 for Sunday to 6 for Saturday, the way the API keeps them
 * onChange(days): called with the new days, in that same numbering and in order
 * label, hint, error: as on Input. Without a label, pass aria-label.
 */
const WeekdayPicker = ({
    value = [],
    onChange,
    label,
    hint,
    error,
    disabled,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [days] = useState(weekOrder);

    return (
        <Field
            id={fieldId}
            label={label}
            labelAs="span"
            hint={hint}
            error={error}
            className={className}
        >
            <ToggleGroup
                multiple
                className={styles.group}
                value={value.map(String)}
                onValueChange={(pressed) => onChange?.(pressed.map(Number).sort())}
                disabled={disabled}
                aria-labelledby={label ? `${fieldId}-label` : undefined}
                aria-describedby={describedBy(fieldId, { hint, error })}
                {...rest}
            >
                {days.map((day) => (
                    <Toggle
                        key={day}
                        value={String(day)}
                        className={styles.day}
                        aria-label={weekdayName(day)}
                    >
                        {weekdayName(day, "short")}
                    </Toggle>
                ))}
            </ToggleGroup>
        </Field>
    );
};

export default WeekdayPicker;
