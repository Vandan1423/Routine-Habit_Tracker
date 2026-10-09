import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import {
    formatTime,
    fromMinutes,
    nearestTime,
    parseTime,
    suggestTimes,
    uses12HourClock,
} from "../../lib/time";
import fieldStyles from "./Field.module.css";
import styles from "./TimePicker.module.css";

const timeNow = () => {
    const now = new Date();
    return fromMinutes(now.getHours() * 60 + now.getMinutes());
};

/**
 * A time of day. Type it the way you would say it ("7", "730", "7:30 pm") or pick it from the list;
 * the list narrows to what has been typed, and offers morning and evening when the typing does not say which.
 * It is written the way the reader's own locale writes times: with am and pm, or on a 24-hour clock.
 *
 * value: "HH:MM" on a 24-hour clock, the way the API keeps it, or "" for none
 * onChange(time): called with a time in the same form once one is chosen, or typed and left.
 *                 Text that is not a time is put back to what was there.
 * step: minutes between the times on the list (30 unless given). Any minute can still be typed.
 * label, hint, error: as on Input. Every other prop goes to the <input> itself.
 */
const TimePicker = ({
    value = "",
    onChange,
    label,
    hint,
    error,
    placeholder,
    step = 30,
    disabled,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const controlRef = useRef(null);
    const hasHighlightRef = useRef(false);
    const justFocusedRef = useRef(false);
    const [hour12] = useState(uses12HourClock);

    const written = formatTime(value, { hour12 });
    const [text, setText] = useState(written);
    const [textIsFor, setTextIsFor] = useState(value);
    const [openedAt, setOpenedAt] = useState("");

    // The value was changed from outside: show the new one
    if (textIsFor !== value) {
        setTextIsFor(value);
        setText(written);
    }

    // While the field still shows its saved time, the whole day is offered. Once something is typed, only what fits it.
    const browsing = text === written;

    const times = useMemo(() => {
        const list = suggestTimes(browsing ? "" : text, { step, hour12 });
        // A saved time that falls between the steps is still on the list, so it can be seen ticked
        return browsing && value && !list.includes(value) ? [...list, value].sort() : list;
    }, [browsing, text, value, step, hour12]);

    // Where the long list opens: at the saved time, or at the time it is now
    const startAt = browsing ? nearestTime(value || openedAt || "09:00", times) : null;

    const scrollToRow = useCallback((row) => {
        const list = row?.parentElement;
        if (list) {
            list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
        }
    }, []);

    const commit = (typed) => {
        const next = typed.trim() === "" ? "" : parseTime(typed);

        if (next === null) {
            setText(written); // not a time: back to what was there
            return;
        }

        setText(formatTime(next, { hour12 }));
        if (next !== value) onChange?.(next);
    };

    return (
        <Autocomplete.Root
            items={times}
            filter={null}
            value={text}
            onValueChange={(next, details) => {
                setText(next);
                if (details.reason === "item-press") commit(next);
            }}
            itemToStringValue={(time) => formatTime(time, { hour12 })}
            onItemHighlighted={(time) => {
                hasHighlightRef.current = time !== undefined;
            }}
            onOpenChange={(open) => {
                if (open) setOpenedAt(timeNow());
            }}
            openOnInputClick
            disabled={disabled}
        >
            <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
                <label
                    ref={controlRef}
                    className={fieldStyles.control}
                    data-invalid={error ? "" : undefined}
                    data-disabled={disabled ? "" : undefined}
                >
                    <span className={fieldStyles.adornment}>
                        <Icon name="clock" />
                    </span>
                    <Autocomplete.Input
                        id={fieldId}
                        className={fieldStyles.input}
                        placeholder={placeholder ?? "Set a time"}
                        // Digits first on a phone: "730" and a tap on the list is the whole job
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy(fieldId, { hint, error })}
                        // Arriving in the field selects the time, so typing replaces it. A second click places the caret.
                        onFocus={(event) => {
                            justFocusedRef.current = true;
                            event.target.select();
                        }}
                        onClick={(event) => {
                            const input = event.target;
                            if (justFocusedRef.current && input.selectionStart === input.selectionEnd) {
                                input.select();
                            }
                            justFocusedRef.current = false;
                        }}
                        onBlur={() => commit(text)}
                        onKeyDown={(event) => {
                            // Enter with nothing picked out on the list takes what was typed.
                            // That is all it does: only a second Enter, on a time already taken, sends the form.
                            if (event.key === "Enter" && !hasHighlightRef.current) {
                                if (text !== written) event.preventDefault();
                                commit(text);
                            }
                        }}
                        {...rest}
                    />
                </label>
            </Field>
            <Autocomplete.Portal>
                <Autocomplete.Positioner
                    className={styles.positioner}
                    anchor={controlRef}
                    align="start"
                    sideOffset={6}
                    collisionPadding={8}
                >
                    <Autocomplete.Popup className={styles.popup}>
                        <Autocomplete.Empty>
                            <p className={styles.empty}>
                                That isn’t a time. Try {formatTime("07:30", { hour12 })}.
                            </p>
                        </Autocomplete.Empty>
                        <Autocomplete.List className={styles.list}>
                            {(time) => (
                                <Autocomplete.Item
                                    key={time}
                                    value={time}
                                    className={styles.row}
                                    ref={time === startAt ? scrollToRow : undefined}
                                >
                                    <span className={styles.rowText}>
                                        {formatTime(time, { hour12 })}
                                    </span>
                                    {time === value && (
                                        <span className={styles.rowEnd}>
                                            <Icon name="check" className={styles.tick} />
                                        </span>
                                    )}
                                </Autocomplete.Item>
                            )}
                        </Autocomplete.List>
                    </Autocomplete.Popup>
                </Autocomplete.Positioner>
            </Autocomplete.Portal>
        </Autocomplete.Root>
    );
};

export default TimePicker;
