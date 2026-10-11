// The reminders today still has to give, by the server's own rules (backend/src/utils/reminders.js): before
// each routine still to do, and for the habits of each part of the day still open. The app shows them itself
// while it is open (components/shell/Reminders.jsx); the server pushes the same ones, under the same keys,
// while it is closed. Worked out from its arguments alone.

import { parseTime, toMinutes } from "./time";

export const DEFAULT_REMINDER_LEAD = 10;

// How early a reminder can come, as the account chooses it
export const REMINDER_LEAD_OPTIONS = [
    { value: 0, label: "When it starts" },
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
];

// A reminder that "starts now" stays worth showing this long after its moment; one ahead of a start, until it
// starts; a habit nudge, for an hour. Opened within that time, the app shows it at once.
const AT_START_WINDOW = 5;
const HABIT_WINDOW = 60;

// When the habits of each part of the day are nudged about, if any is still open
const HABIT_NUDGES = { morning: "08:00", afternoon: "13:00", evening: "18:00", anytime: "20:00" };
const HABIT_HEADINGS = {
    morning: "This morning’s habits",
    afternoon: "This afternoon’s habits",
    evening: "This evening’s habits",
    anytime: "Still open today",
};

const listOf = (titles) =>
    titles.length <= 3 ? titles.join(", ") : `${titles.slice(0, 3).join(", ")} and ${titles.length - 3} more`;

const minutesWords = (minutes) =>
    minutes >= 60 && minutes % 60 === 0
        ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}`
        : `${minutes} minute${minutes === 1 ? "" : "s"}`;

// A moment of the day `date` ("YYYY-MM-DD"), by this device's clock
const momentOf = (date, minutes) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
};

const minutesInto = (date, now) => Math.floor((now - momentOf(date, 0)) / 60000);

/**
 * Today's reminders still to come, or whose moment has come and is still worth showing, soonest first.
 * @param {Object} options
 * @param {String} options.date - the day on screen, "YYYY-MM-DD"
 * @param {Array} options.routines - today's routines, as GET /routines sends them (todayLog for done)
 * @param {Array} options.habits - every habit, as GET /habits sends them (dueToday, todayLog)
 * @param {Date} options.now
 * @param {Number} [options.lead] - minutes before a routine starts
 * @param {Boolean} [options.habitsOn] - whether open habits are nudged about
 * @returns {Array} - each { key, at, title, body, url }; key is the same one the server tags its push with.
 *   `at` is never before `now`: one already due is due now.
 */
export const remindersAhead = ({ date, routines = [], habits = [], now, lead = DEFAULT_REMINDER_LEAD, habitsOn = true }) => {
    if (!date) return [];
    const ahead = [];
    const clock = minutesInto(date, now);

    for (const routine of routines) {
        if (routine.todayLog || !routine.startTime) continue;

        const start = parseTime(routine.startTime);
        if (start === null) continue;

        const startMinutes = toMinutes(start);
        const due = Math.max(startMinutes - lead, 0);
        const until = lead === 0 ? startMinutes + AT_START_WINDOW : startMinutes;
        if (clock >= until) continue;

        const left = startMinutes - Math.max(due, clock);
        ahead.push({
            key: `routine:${routine._id}:${date}`,
            at: clock >= due ? now : momentOf(date, due),
            title: routine.title,
            body: left > 0 ? `Starts in ${minutesWords(left)}.` : "Starting now.",
            url: "/today",
        });
    }

    if (habitsOn) {
        for (const [block, time] of Object.entries(HABIT_NUDGES)) {
            const due = toMinutes(time);
            if (clock >= due + HABIT_WINDOW) continue;
            const at = clock >= due ? now : momentOf(date, due);

            const open = habits.filter(
                (habit) =>
                    habit.dueToday !== false &&
                    !habit.todayLog?.completed &&
                    (habit.timeOfDay ?? "anytime") === block,
            );
            if (open.length === 0) continue;

            ahead.push({
                key: `habits:${block}:${date}`,
                at,
                title: HABIT_HEADINGS[block],
                body: listOf(open.map((habit) => habit.title)),
                url: "/today",
            });
        }
    }

    return ahead.sort((a, b) => a.at - b.at);
};
