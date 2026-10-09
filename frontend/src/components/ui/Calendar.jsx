import { useEffect, useId, useRef, useState } from "react";
import IconButton from "./IconButton";
import { cx } from "../../lib/cx";
import {
    addDays,
    addMonths,
    firstDayOf,
    formatDayTitle,
    formatMonth,
    lastDayOf,
    monthOf,
    weeksOf,
} from "../../lib/dates";
import { firstDayOfWeek, weekdayName, weekOrder } from "../../lib/week";
import styles from "./Calendar.module.css";

// How far each key moves the day that has the focus
const STEPS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

// The same day of another month, or that month's last day where it is shorter
const sameDayIn = (month, day) => {
    const wanted = `${month}-${day.slice(8)}`;
    return wanted > lastDayOf(month) ? lastDayOf(month) : wanted;
};

const clamp = (day, min, max) => {
    if (min && day < min) return min;
    if (max && day > max) return max;
    return day;
};

/**
 * One month as a grid of days, with the months either side a press away.
 * It does two jobs. Given `onSelect` it is for picking a day: the days are buttons, the arrow keys move
 * between them (and on into the next month), Page Up and Page Down turn the month, Enter chooses.
 * Without it, it is for reading: each day shows whatever `renderDay` draws under its number.
 *
 * month, onMonthChange(month): the month on show, "YYYY-MM"
 * today: "YYYY-MM-DD"; that day's number is drawn in the "now" colour
 * min, max: the first and last day there is anything for. Months wholly outside cannot be turned to,
 *           and days outside cannot be picked.
 * value, onSelect(day): the chosen day, when picking
 * renderDay(day): what is drawn under a day's number. describeDay(day): the same, in words.
 *                 Both work when picking too: the day is then a button with its mark inside.
 * full: the month is the page itself, not something in a field's popover: each day takes its whole cell,
 *       with its number at the top and room for its mark under it
 * strongDay(day): true for a day whose number is set in full ink, to pick some days out (with `full`)
 * label: what the calendar is of, for screen readers
 */
const Calendar = ({
    month,
    onMonthChange,
    today,
    min,
    max,
    value,
    onSelect,
    renderDay,
    describeDay,
    full = false,
    strongDay,
    label,
    className,
}) => {
    const headingId = useId();
    const gridRef = useRef(null);
    const [firstDay] = useState(firstDayOfWeek);
    // The day the arrow keys last moved to, which takes the focus once its month is on show
    const [reach, setReach] = useState(null);
    const picking = Boolean(onSelect);

    const weeks = weeksOf(month, firstDay);
    const canGoBack = !min || monthOf(min) < month;
    const canGoOn = !max || monthOf(max) > month;

    // Which day Tab lands on: the one last reached, the chosen one, today, or the first that can be picked
    const inMonth = (day) => Boolean(day) && monthOf(day) === month;
    const home =
        [reach, value, today].find(inMonth) ?? clamp(firstDayOf(month), min, max);

    useEffect(() => {
        if (reach && monthOf(reach) === month) {
            gridRef.current?.querySelector(`[data-day="${reach}"]`)?.focus();
        }
    }, [reach, month]);

    const moveTo = (day) => {
        const next = clamp(day, min, max);

        setReach(next);
        if (monthOf(next) !== month) onMonthChange(monthOf(next));
    };

    const onKeyDown = (event) => {
        const from = event.target.closest("[data-day]")?.dataset.day;
        if (!from) return;

        let next = null;
        if (STEPS[event.key]) next = addDays(from, STEPS[event.key]);
        else if (event.key === "PageUp") next = sameDayIn(addMonths(monthOf(from), -1), from);
        else if (event.key === "PageDown") next = sameDayIn(addMonths(monthOf(from), 1), from);
        else if (event.key === "Home") next = firstDayOf(monthOf(from));
        else if (event.key === "End") next = lastDayOf(monthOf(from));
        if (!next) return;

        event.preventDefault();
        moveTo(next);
    };

    return (
        <div className={cx(styles.calendar, picking && styles.picking, full && styles.full, className)}>
            <div className={styles.head}>
                <span id={headingId} className={styles.month} aria-live="polite">
                    {formatMonth(month)}
                </span>
                <IconButton
                    icon="chevron-left"
                    size="sm"
                    label="Previous month"
                    disabled={!canGoBack}
                    onClick={() => onMonthChange(addMonths(month, -1))}
                />
                <IconButton
                    icon="chevron-right"
                    size="sm"
                    label="Next month"
                    disabled={!canGoOn}
                    onClick={() => onMonthChange(addMonths(month, 1))}
                />
            </div>
            <div
                ref={gridRef}
                role="grid"
                aria-label={label}
                aria-labelledby={label ? undefined : headingId}
                className={styles.grid}
                onKeyDown={picking ? onKeyDown : undefined}
            >
                <div role="row" className={styles.week}>
                    {weekOrder(firstDay).map((day) => (
                        <span
                            key={day}
                            role="columnheader"
                            aria-label={weekdayName(day)}
                            className={styles.weekday}
                        >
                            {weekdayName(day, "short").slice(0, 2)}
                        </span>
                    ))}
                </div>
                {weeks.map((week, index) => (
                    <div key={index} role="row" className={styles.week}>
                        {week.map((day, cell) => {
                            if (!day) return <span key={cell} role="gridcell" className={styles.cell} />;

                            const number = Number(day.slice(8));
                            const isToday = day === today;
                            const outside = Boolean((min && day < min) || (max && day > max));

                            const said = describeDay?.(day);

                            if (picking) {
                                return (
                                    <span key={day} role="gridcell" className={styles.cell}>
                                        <button
                                            type="button"
                                            className={cx(
                                                styles.day,
                                                isToday && styles.today,
                                                strongDay?.(day) && styles.strong,
                                            )}
                                            data-day={day}
                                            tabIndex={day === home ? 0 : -1}
                                            disabled={outside}
                                            aria-pressed={value === undefined ? undefined : day === value}
                                            aria-current={isToday ? "date" : undefined}
                                            aria-label={`${formatDayTitle(day)}${said ? `: ${said}` : ""}`}
                                            onClick={() => onSelect(day)}
                                        >
                                            {renderDay ? (
                                                <>
                                                    <span className={styles.number}>{number}</span>
                                                    <span className={styles.mark}>{!outside && renderDay(day)}</span>
                                                </>
                                            ) : (
                                                number
                                            )}
                                        </button>
                                    </span>
                                );
                            }

                            return (
                                <span
                                    key={day}
                                    role="gridcell"
                                    className={cx(
                                        styles.cell,
                                        styles.shown,
                                        isToday && styles.today,
                                        outside && styles.outside,
                                    )}
                                    aria-current={isToday ? "date" : undefined}
                                >
                                    <span className={styles.number} aria-hidden="true">
                                        {number}
                                    </span>
                                    <span className="visually-hidden">
                                        {formatDayTitle(day)}
                                        {said ? `: ${said}` : ""}
                                    </span>
                                    <span className={styles.mark}>{renderDay?.(day)}</span>
                                </span>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Calendar;
