import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useCarry from "../../hooks/useCarry";
import { cx } from "../../lib/cx";
import { minutesOf } from "../../lib/day";
import { formatTimeRange, uses12HourClock } from "../../lib/time";
import { gridRange, placeEvents, shifted, timeAt } from "../../lib/weekGrid";
import styles from "./WeekGrid.module.css";

// How tall an hour is drawn. The stylesheet takes it from here, so carrying a block can count in hours.
const HOUR_PX = 48;

// The hour down the side: "7 am", or "07:00" on a 24-hour clock
const hourLabel = (hour, hour12) =>
    hour12 ? `${hour % 12 || 12} ${hour < 12 ? "am" : "pm"}` : `${String(hour).padStart(2, "0")}:00`;

// One thing on the grid, from its start to its end. A link when it leads to a page, a button when
// pressing it opens something; either way it can be carried when the grid allows it.
const Block = ({ event, place, from, carry, carrying }) => {
    const minutes = place.to - place.from;
    const style = {
        "--top": place.from - from * 60,
        "--length": minutes,
        "--lane": place.lane,
        "--lanes": place.lanes,
        ...(carrying ? { "--dx": `${carrying.dx}px`, "--dy": `${carrying.dy}px` } : {}),
    };
    const className = cx(
        styles.block,
        styles[event.tone ?? "plain"],
        event.kind === "todo" && styles.todo,
        minutes < 45 && styles.short,
        carrying && styles.carried,
    );
    const inside = (
        <>
            <span className={styles.blockTitle}>{event.title}</span>
            <span className={styles.blockTime}>
                {carrying?.label ?? formatTimeRange(event.start, event.end)}
            </span>
        </>
    );
    const props = {
        className,
        style,
        "aria-label": event.label ?? `${event.title}, ${formatTimeRange(event.start, event.end)}`,
        ...(carry ?? {}),
    };

    if (event.to) {
        return (
            <Link to={event.to} {...props}>
                {inside}
            </Link>
        );
    }
    return (
        <button type="button" onClick={event.onPress} {...props}>
            {inside}
        </button>
    );
};

/**
 * A week as a calendar: a column for each day, the hours down the side, and whatever has a time drawn as
 * a block from its start to its end (things that overlap side by side). Over the hours, a band for each
 * day holds what has no time. Only the hours anything uses are drawn (six in the morning to ten at night
 * at the least) until the whole day is asked for. Today's column carries the line of the time it is now.
 *
 * days: [{ date, head (what its column is headed with), today, past, closed }]: a past day is drawn
 *   quieter; a closed one takes nothing new (no press to create, nothing carried onto it)
 * events: [{ key, date, start, end, title, kind ("routine" | "todo"), tone ("plain" | "done" | "late" |
 *   "missed" | "open"), to (an address it leads to) or onPress(), label (to a screen reader), movable }]
 * bands: { [date]: what that day's band holds }, or null for no bands
 * now: the moment it is (for the line on today's column)
 * onCreate(date, time): an empty part of a day was pressed; the time is that point, to the half hour
 * onMove(event, { date, start, end }): a movable block was carried to another time (and, with `across`,
 *   to another day)
 * label: what the calendar is of, for screen readers
 */
const WeekGrid = ({ days, events, bands = null, now, onCreate, onMove, across = false, label, className }) => {
    const [whole, setWhole] = useState(false);
    const [over, setOver] = useState(null);
    const range = gridRange(events, { whole });
    const hours = Array.from({ length: range.to - range.from }, (_, index) => range.from + index);

    const byDay = useMemo(() => {
        const map = new Map(days.map((day) => [day.date, []]));
        for (const event of events) map.get(event.date)?.push(event);
        return map;
    }, [days, events]);
    const places = useMemo(
        () => new Map([...byDay].map(([date, list]) => [date, placeEvents(list)])),
        [byDay],
    );

    const [hour12] = useState(uses12HourClock);

    // A block carried by the pointer lands as many minutes later as it was carried down, onto the day under it
    const { handle, carrying } = useCarry({
        onOver: (place) => setOver(place?.dataset.drop ?? null),
        onDrop: ({ data, place, dy }) => {
            const next = shifted(data, (dy / HOUR_PX) * 60);
            const date = across && place?.dataset.drop ? place.dataset.drop : data.date;
            if (next.start !== data.start || date !== data.date) onMove?.(data, { date, ...next });
        },
    });
    const carried = carrying && events.find((event) => event.key === carrying.id);
    const carriedTo = carried ? shifted(carried, (carrying.dy / HOUR_PX) * 60) : null;
    const carriedLabel = carriedTo ? formatTimeRange(carriedTo.start, carriedTo.end) : null;

    const create = (day) => (event) => {
        if (!onCreate || day.closed || event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        const minutes = ((event.clientY - box.top) / box.height) * (range.to - range.from) * 60;
        onCreate(day.date, timeAt(minutes, range.from, 30));
    };

    const nowMinutes = now ? minutesOf(now) : null;
    const nowShown = nowMinutes !== null && nowMinutes >= range.from * 60 && nowMinutes < range.to * 60;

    return (
        <div
            className={cx(styles.grid, className)}
            style={{ "--days": days.length, "--hours": range.to - range.from, "--hour": `${HOUR_PX}px` }}
            role="group"
            aria-label={label}
        >
            <div className={styles.head}>
                <span className={styles.corner} aria-hidden="true" />
                {days.map((day) => (
                    <div
                        key={day.date}
                        className={cx(styles.dayHead, day.today && styles.today, day.past && styles.past)}
                    >
                        {day.head}
                    </div>
                ))}
            </div>

            {bands && (
                <div className={styles.bands}>
                    <span className={styles.bandLabel}>Any time</span>
                    {days.map((day) => (
                        <div key={day.date} className={cx(styles.band, day.today && styles.todayBand)}>
                            {bands[day.date]}
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.body}>
                <div className={styles.times} aria-hidden="true">
                    {hours.map((hour) => (
                        <span key={hour} style={{ "--at": hour - range.from }}>
                            {hour === range.from ? "" : hourLabel(hour, hour12)}
                        </span>
                    ))}
                </div>
                {days.map((day) => (
                    <div
                        key={day.date}
                        className={cx(
                            styles.column,
                            day.today && styles.todayColumn,
                            day.past && styles.pastColumn,
                            onCreate && !day.closed && styles.creates,
                            over === day.date && styles.over,
                        )}
                        data-drop={day.closed ? undefined : day.date}
                        onClick={create(day)}
                    >
                        {(byDay.get(day.date) ?? []).map((event) => {
                            const place = places.get(day.date).get(event.key);
                            const mine = carrying?.id === event.key;
                            return (
                                <Block
                                    key={event.key}
                                    event={event}
                                    place={place}
                                    from={range.from}
                                    carry={
                                        event.movable && onMove
                                            ? { ...handle(event.key, event), "data-grid-event": event.key }
                                            : { "data-grid-event": event.key }
                                    }
                                    carrying={mine ? { ...carrying, label: carriedLabel } : null}
                                />
                            );
                        })}
                        {day.today && nowShown && (
                            <span
                                className={styles.now}
                                style={{ "--top": nowMinutes - range.from * 60 }}
                                aria-hidden="true"
                            />
                        )}
                    </div>
                ))}
            </div>

            <button type="button" className={styles.extent} onClick={() => setWhole((current) => !current)}>
                {whole ? "Show the usual hours" : "Show the whole day"}
            </button>
        </div>
    );
};

export default WeekGrid;
