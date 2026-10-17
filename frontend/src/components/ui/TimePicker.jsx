import { useId, useRef, useState } from "react";
import Button from "./Button";
import ClockFace from "./ClockFace";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import Popover from "./Popover";
import { cx } from "../../lib/cx";
import {
    draftOf,
    halfOf,
    shownHour,
    startingDraft,
    stepDraft,
    timeOf,
    typeHourDigit,
    typeMinuteDigit,
    withHalf,
} from "../../lib/clock";
import { formatTime, parseTime, uses12HourClock } from "../../lib/time";
import fieldStyles from "./Field.module.css";
import styles from "./TimePicker.module.css";

const NOTHING_TYPED = { hours: null, minutes: null };

// What a change to a box's text added: a whole time when one was pasted or dropped in ("8:15 pm"),
// otherwise the digit, or the half of the day, typed at its end. Taking something out adds nothing.
const lastTyped = (event) => {
    if (event.nativeEvent?.inputType?.startsWith("delete")) return null;

    const text = event.target.value;
    const whole = text.length > 2 ? parseTime(text) : null;
    if (whole) return { time: whole };

    const last = text.slice(-1).toLowerCase();
    if (/\d/.test(last)) return { digit: Number(last) };
    if (last === "a" || last === "p") return { half: last === "a" ? "am" : "pm" };
    return null;
};

const select = (input) => requestAnimationFrame(() => input?.select());

/**
 * A time of day, picked on a clock face. The field opens a panel with the hour and the minute in two
 * boxes, am and pm beside them where the reader's clock has them, and the dial under them: press an hour,
 * then a minute, or drag the hand round. Typing works too: the cursor starts in the hour, so "7", "3", "0"
 * and Enter is 7:30. "A" and "P" choose the half of the day, the arrow keys step, Esc leaves it as it was.
 *
 * value: "HH:MM" on a 24-hour clock, the way the API keeps it, or "" for none
 * onChange(time): called with a time in the same form once "Set" is pressed, or "" when cleared
 * openAt: the time the dial starts on while there is none ("HH:MM"); the next five minutes from now unless given
 * clearable: offers "Clear", for a time that may be left out
 * label, hint, error, placeholder: as on Input. Every other prop goes to the field's own button.
 */
const TimePicker = ({
    value = "",
    onChange,
    openAt,
    clearable = false,
    label,
    hint,
    error,
    placeholder = "Set a time",
    disabled,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const [hour12] = useState(uses12HourClock);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => startingDraft(value || openAt));
    const [view, setView] = useState("hours");
    // A digit typed into a box that could still be the start of a longer number
    const [typing, setTyping] = useState(NOTHING_TYPED);
    const hourBox = useRef(null);
    const minuteBox = useRef(null);

    const onOpenChange = (next) => {
        // Each time it opens, it starts from the time in the field, on the hours
        if (next) {
            setDraft(value ? draftOf(value) : startingDraft(openAt));
            setView("hours");
            setTyping(NOTHING_TYPED);
        }
        setOpen(next);
    };

    const set = () => {
        const time = timeOf(draft);
        setOpen(false);
        if (time !== value) onChange?.(time);
    };

    const clear = () => {
        setOpen(false);
        if (value) onChange?.("");
    };

    const toMinutes = () => {
        setView("minutes");
        minuteBox.current?.focus();
        select(minuteBox.current);
    };

    // A whole time put in either box is the time, and the cursor stays where it is
    const takeWhole = (time, input) => {
        setDraft(draftOf(time));
        setTyping(NOTHING_TYPED);
        select(input);
    };

    const typeHour = (event) => {
        const typed = lastTyped(event);
        if (!typed) return;
        if (typed.time) return takeWhole(typed.time, event.target);
        if (typed.half) {
            if (hour12) setDraft((current) => withHalf(current, typed.half));
            return;
        }

        const next = typeHourDigit(typed.digit, typing.hours, draft, { hour12 });
        setDraft((current) => ({ ...current, hours: next.hours }));
        setTyping((current) => ({ ...current, hours: next.pending }));
        if (next.done) toMinutes();
    };

    const typeMinute = (event) => {
        const typed = lastTyped(event);
        if (!typed) return;
        if (typed.time) return takeWhole(typed.time, event.target);
        if (typed.half) {
            if (hour12) setDraft((current) => withHalf(current, typed.half));
            return;
        }

        const next = typeMinuteDigit(typed.digit, typing.minutes);
        setDraft((current) => ({ ...current, minutes: next.minutes }));
        setTyping((current) => ({ ...current, minutes: next.pending }));
        // Ready for the next minute to be typed over this one
        if (next.done) select(minuteBox.current);
    };

    const keys = (box) => (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            set();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setTyping(NOTHING_TYPED);
            setDraft((current) => stepDraft(current, box, event.key === "ArrowUp" ? 1 : -1));
            select(event.currentTarget);
        } else if (box === "hours" && (event.key === ":" || event.key === ".")) {
            event.preventDefault();
            toMinutes();
        }
    };

    const box = (which) => ({
        className: cx(styles.box, view === which && styles.current),
        inputMode: "numeric",
        autoComplete: "off",
        enterKeyHint: "done",
        onFocus: (event) => {
            setView(which);
            event.target.select();
        },
        // A digit left waiting when the cursor moves on stands as it is
        onBlur: () => setTyping((current) => ({ ...current, [which]: null })),
        onKeyDown: keys(which),
    });

    const half = halfOf(draft);

    return (
        <Field id={fieldId} label={label} labelAs="span" hint={hint} error={error} className={className}>
            <Popover
                open={open}
                onOpenChange={onOpenChange}
                title={label}
                className={styles.popup}
                initialFocus={hourBox}
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
                        <span className={fieldStyles.adornment}>
                            <Icon name="clock" />
                        </span>
                        <span className={cx(styles.value, !value && styles.placeholder)}>
                            {value ? formatTime(value, { hour12 }) : placeholder}
                        </span>
                    </button>
                }
            >
                <div className={styles.readout}>
                    <input
                        ref={hourBox}
                        aria-label="Hour"
                        value={typing.hours !== null ? String(typing.hours) : shownHour(draft.hours, { hour12 })}
                        onChange={typeHour}
                        {...box("hours")}
                    />
                    <span className={styles.colon} aria-hidden="true">
                        :
                    </span>
                    <input
                        ref={minuteBox}
                        aria-label="Minutes"
                        value={typing.minutes !== null ? String(typing.minutes) : String(draft.minutes).padStart(2, "0")}
                        onChange={typeMinute}
                        {...box("minutes")}
                    />
                    {hour12 && (
                        <div className={styles.halves} role="group" aria-label="Morning or afternoon">
                            {["am", "pm"].map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={styles.half}
                                    aria-pressed={half === option}
                                    onClick={() => setDraft((current) => withHalf(current, option))}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <ClockFace
                    view={view}
                    draft={draft}
                    hour12={hour12}
                    onPick={(picked) => {
                        setTyping(NOTHING_TYPED);
                        setDraft((current) =>
                            view === "hours" ? { ...current, hours: picked } : { ...current, minutes: picked },
                        );
                    }}
                    onPicked={() => {
                        if (view === "hours") toMinutes();
                    }}
                />

                <div className={styles.actions}>
                    {clearable && value && (
                        <Button variant="ghost" size="sm" className={styles.clear} onClick={clear}>
                            Clear
                        </Button>
                    )}
                    <Popover.Close render={<Button size="sm">Cancel</Button>} />
                    <Button variant="primary" size="sm" onClick={set}>
                        Set
                    </Button>
                </div>
            </Popover>
        </Field>
    );
};

export default TimePicker;
