import { useId, useRef, useState } from "react";
import Calendar from "./Calendar";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import Popover from "./Popover";
import { cx } from "../../lib/cx";
import { formatDayPlain, monthOf } from "../../lib/dates";
import fieldStyles from "./Field.module.css";
import styles from "./DatePicker.module.css";

/**
 * One calendar day. The field shows the day in words and opens a month to pick from;
 * choosing a day closes it again.
 *
 * value: "YYYY-MM-DD", the way the API keeps it, or "" for none
 * onChange(day): called with a day in the same form
 * today: "YYYY-MM-DD", marked on the calendar. min, max: the first and last day that can be chosen.
 * format(day): how the chosen day is written in the field ("Friday 9 October" unless given)
 * label, hint, error: as on Input. Every other prop goes to the button itself.
 */
const DatePicker = ({
    value = "",
    onChange,
    today,
    min,
    max,
    format = formatDayPlain,
    label,
    hint,
    error,
    placeholder = "Choose a day",
    disabled,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const calendarRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(() => monthOf(value || today || min || "2000-01-01"));

    const onOpenChange = (next) => {
        // Each time it opens, it opens on the month of the day in the field
        if (next) setMonth(monthOf(value || today || min || month));
        setOpen(next);
    };

    return (
        <Field id={fieldId} label={label} labelAs="span" hint={hint} error={error} className={className}>
            <Popover
                open={open}
                onOpenChange={onOpenChange}
                className={styles.popup}
                // Opens with the keyboard on the day itself, so the arrow keys work at once
                initialFocus={() => calendarRef.current?.querySelector("[data-day][tabindex='0']")}
                trigger={
                    <button
                        type="button"
                        id={fieldId}
                        className={cx(fieldStyles.control, styles.trigger)}
                        disabled={disabled}
                        data-invalid={error ? "" : undefined}
                        aria-invalid={error ? true : undefined}
                        aria-labelledby={label ? `${fieldId}-label ${fieldId}` : undefined}
                        aria-describedby={describedBy(fieldId, { hint, error })}
                        {...rest}
                    >
                        <span className={cx(styles.value, !value && styles.placeholder)}>
                            {value ? format(value) : placeholder}
                        </span>
                        <Icon name="calendar" className={styles.icon} />
                    </button>
                }
            >
                <div ref={calendarRef}>
                    <Calendar
                        month={month}
                        onMonthChange={setMonth}
                        today={today}
                        min={min}
                        max={max}
                        value={value}
                        label={label}
                        onSelect={(day) => {
                            onChange?.(day);
                            setOpen(false);
                        }}
                    />
                </div>
            </Popover>
        </Field>
    );
};

export default DatePicker;
