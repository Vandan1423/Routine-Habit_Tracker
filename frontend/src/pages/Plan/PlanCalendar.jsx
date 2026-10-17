import { useState } from "react";
import { Link } from "react-router-dom";
import { itemPath } from "./planPaths";
import { MiniStrip } from "../../components/day";
import { WeekGrid } from "../../components/week";
import useMediaQuery from "../../hooks/useMediaQuery";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { overlapWords, weekDayWords } from "../../lib/itemWords";
import { overlapsIn } from "../../lib/weekGrid";
import { weekdayName } from "../../lib/week";
import styles from "./PlanCalendar.module.css";

const numberFormat = new Intl.NumberFormat();

// What the bands show of a day's habits before the rest wait behind "more"
const BAND_SHOWN = 4;

// How a routine or habit stands on a day of this week: by what was recorded for a day that has ended,
// by what Today shows for today, and as nothing yet for a day still to come
const toneOf = (item, day, { marks, live }) => {
    if (day.when === "ahead") return "plain";

    if (day.when === "today") {
        const now = live.get(item.key);
        if (!now) return "plain";
        if (now.done) return now.late ? "late" : "done";
        if (item.kind === "habit" && now.progress > 0) return "partial";
        return now.overdue ? "open" : "plain";
    }

    const mark = marks.get(`${day.date}|${item.kind}|${item.id}`);
    return mark?.status ?? "plain";
};

const TONE_WORDS = { done: "done", late: "done late", partial: "partly done", missed: "missed", open: "not done yet" };

// The head of a day's column: its name and date, and how it has gone or what it asks
const DayHead = ({ day }) => (
    <>
        <span className={styles.name}>
            <span className={styles.weekday}>{weekdayName(day.day, "short")}</span>
            <span className={cx(styles.number, day.when === "today" && styles.nowNumber)}>
                {Number(day.date.slice(8))}
            </span>
        </span>
        <span className={styles.standing}>
            <MiniStrip total={day.total} done={day.done} settled={day.when === "past"} />
            <span className={styles.count} aria-hidden="true">
                {day.when === "ahead"
                    ? numberFormat.format(day.total)
                    : day.total > 0
                      ? `${numberFormat.format(day.done)}/${numberFormat.format(day.total)}`
                      : "–"}
            </span>
        </span>
        <span className="visually-hidden">
            {formatDayPlain(day.date)}
            {day.when === "today" ? ", today" : ""}: {weekDayWords(day)}
        </span>
    </>
);

/**
 * The plan as a calendar of the week today is in: a column for each day, the routines as blocks at their
 * hours, and the habits in a band over them, each drawn by how it has gone this week (filled once done,
 * outlined in the colour of a loss once missed). A block leads to its page; an empty hour starts a new
 * routine there; a routine carried up or down the day moves to that time on every day it falls on.
 * On a phone it shows one day at a time.
 *
 * standing: from weekStanding, its days with their items (lib/plan.js)
 * marks: Map of "date|kind|id" => { status } for the days of this week that have ended
 * live: Map of key => today's item as Today draws it (lib/day.js)
 * now: the moment it is
 * onCreate(date, time), onMove(item, { start, end })
 */
const PlanCalendar = ({ standing, marks, live, now, onCreate, onMove }) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const todayIndex = Math.max(
        standing.days.findIndex((day) => day.when === "today"),
        0,
    );
    const [picked, setPicked] = useState(null);
    const [allHabits, setAllHabits] = useState(false);
    const shownDays = isPhone ? [standing.days[picked ?? todayIndex]] : standing.days;

    const context = { marks, live };
    const days = shownDays.map((day) => ({
        date: day.date,
        head: <DayHead day={day} />,
        today: day.when === "today",
        past: day.when === "past",
    }));

    const events = shownDays.flatMap((day) =>
        day.items
            .filter((item) => item.kind === "routine" && item.start)
            .map((item) => {
                const tone = toneOf(item, day, context);
                return {
                    key: `${day.date}|${item.key}`,
                    date: day.date,
                    start: item.start,
                    end: item.end,
                    title: item.title,
                    kind: "routine",
                    tone,
                    to: itemPath(item),
                    label: `${item.title}${TONE_WORDS[tone] ? `, ${TONE_WORDS[tone]}` : ""}`,
                    // A one-off task keeps its own time on its one day; a repeating routine moves on every day
                    movable: !item.saving,
                    item,
                };
            }),
    );

    const bands = Object.fromEntries(
        shownDays.map((day) => {
            const habits = day.items.filter((item) => item.kind === "habit" || !item.start);
            const shown = allHabits ? habits : habits.slice(0, BAND_SHOWN);

            return [
                day.date,
                <>
                    {shown.map((item) => {
                        const tone = toneOf(item, day, context);
                        return (
                            <Link
                                key={item.key}
                                to={itemPath(item)}
                                className={cx(styles.chip, styles[tone])}
                                aria-label={`${item.title}${TONE_WORDS[tone] ? `, ${TONE_WORDS[tone]}` : ""}`}
                            >
                                <span className={styles.mark} aria-hidden="true" />
                                <span className={styles.chipTitle}>{item.title}</span>
                            </Link>
                        );
                    })}
                    {!allHabits && habits.length > BAND_SHOWN && (
                        <button type="button" className={styles.moreChips} onClick={() => setAllHabits(true)}>
                            {numberFormat.format(habits.length - BAND_SHOWN)} more
                        </button>
                    )}
                </>,
            ];
        }),
    );

    // Things on one day that run into each other are pointed out in words as well as side by side
    const overlaps = shownDays.flatMap((day) =>
        overlapsIn(events.filter((event) => event.date === day.date)).map(([a, b]) => ({ day, a, b })),
    );
    const said = overlapWords(overlaps.map(({ day, a, b }) => ({ day: day.day, first: a.title, second: b.title })));

    return (
        <div className={styles.calendar}>
            {isPhone && (
                <div className={styles.picker} role="group" aria-label="Day to show">
                    {standing.days.map((day, index) => (
                        <button
                            key={day.date}
                            type="button"
                            className={cx(styles.pick, day.when === "today" && styles.pickToday)}
                            aria-pressed={index === (picked ?? todayIndex)}
                            onClick={() => setPicked(index)}
                        >
                            <span>{weekdayName(day.day, "short")}</span>
                            <span className={styles.pickCount}>
                                {day.when === "ahead" || day.total === 0
                                    ? numberFormat.format(day.total)
                                    : `${day.done}/${day.total}`}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <WeekGrid
                days={days}
                events={events}
                bands={bands}
                now={now}
                label="This week’s plan, hour by hour"
                onCreate={onCreate}
                onMove={(event, next) => onMove(event.item, next)}
            />

            {said && <p className={styles.overlaps}>{said}</p>}
            <p className={styles.hint}>
                Press an empty hour to add a routine there. Drag a routine up or down (hold it first on a
                phone) to change its time on every day it falls on.
            </p>
        </div>
    );
};

export default PlanCalendar;
