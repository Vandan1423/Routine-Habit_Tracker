import { useMemo } from "react";
import { DayBlock, DayHeader, DayProgress } from "../../components/day";
import { formatDayTitle, localDay } from "../../lib/dates";
import { buildDay, minutesOf } from "../../lib/day";
import { dayMessage, greetingAt } from "../../lib/dayMessage";
import styles from "./SampleDay.module.css";

// A made-up day, held at 1:35 in the afternoon: a morning finished, an afternoon about to start
const HOUR = 13;
const MINUTE = 35;

const ROUTINES = [
    { _id: "wake", title: "Wake up", startTime: "06:30", xpReward: 10, todayLog: { wasOnTime: true, xpEarned: 10 } },
    { _id: "workout", title: "Workout", startTime: "07:00", endTime: "07:45", xpReward: 10, todayLog: { wasOnTime: true, xpEarned: 10 } },
    { _id: "focus", title: "Deep work", startTime: "14:00", endTime: "16:00", xpReward: 10, todayLog: null },
    { _id: "walk", title: "Walk", startTime: "17:30", xpReward: 10, todayLog: null },
    { _id: "plan", title: "Plan tomorrow", startTime: "21:30", xpReward: 10, todayLog: null },
];

const HABITS = [
    { _id: "meditate", title: "Meditate", timeOfDay: "morning", habitType: "boolean", targetQuantity: 1, xpReward: 15, todayLog: { completed: true, quantity: 1, xpEarned: 15 } },
    { _id: "journal", title: "Journal", timeOfDay: "evening", habitType: "boolean", targetQuantity: 1, xpReward: 10, todayLog: null },
    { _id: "read", title: "Read", timeOfDay: "anytime", habitType: "quantity", targetQuantity: 20, unit: "pages", xpReward: 15, todayLog: { completed: false, quantity: 10 } },
];

const nothing = () => {};

/**
 * What a day looks like in the app, for someone who has not signed in yet: drawn with the pieces Today
 * itself is made of, on a day that never changes. It is a picture: nothing in it can be pressed, and
 * whoever places it keeps it from the keyboard and from screen readers.
 */
const SampleDay = () => {
    const { day, now, date } = useMemo(() => {
        const moment = new Date();
        moment.setHours(HOUR, MINUTE, 0, 0);

        return {
            now: moment,
            date: localDay(moment),
            day: buildDay({ routines: ROUTINES, habits: HABITS, now: moment }),
        };
    }, []);

    return (
        <div className={styles.sheet}>
            <DayHeader eyebrow={greetingAt(now)} title={formatDayTitle(date)} />
            <DayProgress
                message={dayMessage(day, { nowMinutes: minutesOf(now), date })}
                done={day.done}
                total={day.total}
                blocks={day.blocks}
            />
            {day.blocks.map((block) => (
                <DayBlock
                    key={block.id}
                    block={block}
                    next={day.next}
                    now={now}
                    onCheck={nothing}
                    onStep={nothing}
                />
            ))}
        </div>
    );
};

export default SampleDay;
