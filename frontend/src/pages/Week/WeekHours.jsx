import { useState } from "react";
import { MiniStrip } from "../../components/day";
import { WeekGrid } from "../../components/week";
import useMediaQuery from "../../hooks/useMediaQuery";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { isDraftId } from "../../lib/drafts";
import { weekdayName } from "../../lib/week";
import { dayStandingWords } from "../../lib/weekWords";
import { itemPath } from "../Plan/planPaths";
import styles from "./WeekPage.module.css";

// How a routine stood on a day, for its block: by what was recorded, by what Today shows, or not yet
const routineTone = (item, day, { marks, live }) => {
    if (day.when === "ahead") return "plain";
    if (day.when === "today") {
        const now = live.get(item.key);
        if (!now) return "plain";
        if (now.done) return now.late ? "late" : "done";
        return now.overdue ? "open" : "plain";
    }
    return marks.get(`${day.date}|${item.kind}|${item.id}`)?.status ?? "plain";
};

/**
 * The week hour by hour: the routines the plan asks of each day at their times, and the to-dos planned
 * at a time, which can be carried to another time or another day. A to-do with no time sits in the band
 * over the hours. Pressing an empty hour writes a new to-do there. On a phone, one day at a time.
 *
 * week: from buildWeek. marks, live: as on Plan's calendar. now: the moment it is
 * onCreate(date, time), onOpen(todo), onPlan(todo, { date, time, endTime })
 */
const WeekHours = ({ week, marks, live, now, onCreate, onOpen, onPlan }) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const todayIndex = Math.max(week.days.findIndex((day) => day.when === "today"), 0);
    const [picked, setPicked] = useState(null);
    const shownDays = isPhone ? [week.days[picked ?? todayIndex]] : week.days;

    const days = shownDays.map((day) => ({
        date: day.date,
        today: day.when === "today",
        past: day.when === "past",
        // Nothing new is planned for a day that has gone by
        closed: day.when === "past",
        head: (
            <>
                <span className={styles.gridDay}>
                    <span>{weekdayName(day.day, "short")}</span>
                    <b className={cx(day.when === "today" && styles.nowNumber)}>{Number(day.date.slice(8))}</b>
                </span>
                <MiniStrip total={day.standing.total} done={day.standing.done} settled={day.when === "past"} />
                <span className="visually-hidden">
                    {formatDayPlain(day.date)}: {dayStandingWords(day)}
                </span>
            </>
        ),
    }));

    const events = shownDays.flatMap((day) => [
        ...day.items
            .filter((item) => item.kind === "routine" && item.start)
            .map((item) => ({
                key: `${day.date}|${item.key}`,
                date: day.date,
                start: item.start,
                end: item.end,
                title: item.title,
                kind: "routine",
                tone: routineTone(item, day, { marks, live }),
                to: itemPath(item),
            })),
        ...day.todos
            .filter((todo) => todo.time)
            .map((todo) => ({
                key: `todo:${todo._id}`,
                date: day.date,
                start: todo.time,
                end: todo.endTime,
                title: todo.title,
                kind: "todo",
                tone: todo.done ? "done" : day.when === "past" ? "open" : "plain",
                onPress: () => onOpen(todo),
                label: `To-do: ${todo.title}${todo.done ? ", done" : ""}`,
                movable: !isDraftId(todo._id),
                todo,
            })),
    ]);

    const bands = Object.fromEntries(
        shownDays.map((day) => [
            day.date,
            day.todos
                .filter((todo) => !todo.time)
                .map((todo) => (
                    <button
                        key={todo._id}
                        type="button"
                        className={cx(styles.bandTodo, todo.done && styles.bandDone)}
                        onClick={() => onOpen(todo)}
                    >
                        <span className={styles.bandBox} aria-hidden="true" />
                        <span className={styles.bandTitle}>{todo.title}</span>
                    </button>
                )),
        ]),
    );

    return (
        <div className={styles.hours}>
            {isPhone && (
                <div className={styles.picker} role="group" aria-label="Day to show">
                    {week.days.map((day, index) => (
                        <button
                            key={day.date}
                            type="button"
                            className={cx(styles.pick, day.when === "today" && styles.pickToday)}
                            aria-pressed={index === (picked ?? todayIndex)}
                            onClick={() => setPicked(index)}
                        >
                            <span>{weekdayName(day.day, "short")}</span>
                            <span className={styles.pickCount}>{Number(day.date.slice(8))}</span>
                        </button>
                    ))}
                </div>
            )}
            <WeekGrid
                days={days}
                events={events}
                bands={bands}
                now={now}
                across
                label="The week, hour by hour"
                onCreate={onCreate}
                onMove={(event, next) =>
                    event.todo && onPlan(event.todo, { date: next.date, time: next.start, endTime: next.end })
                }
            />
            <p className={styles.gridHint}>
                Press an empty hour to plan a to-do there. Drag a to-do to another time or day; routines move on Plan.
            </p>
        </div>
    );
};

export default WeekHours;
