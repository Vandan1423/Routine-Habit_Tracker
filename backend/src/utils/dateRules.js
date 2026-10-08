// Calendar-day logic. A "day" always belongs to a user: it starts and ends at midnight in their timezone,
// not the server's. Dates travel as "YYYY-MM-DD" strings and are compared as strings.

const DAY_MS = 24 * 60 * 60 * 1000;

// Used until a client has told us where the user is
export const DEFAULT_TIMEZONE = "UTC";

// How often an account's timezone may change. Travel changes it once; this stops someone
// from flipping zones back and forth to reopen a day that has already ended.
export const TIMEZONE_CHANGE_COOLDOWN_MS = DAY_MS;

const formatters = new Map();

const getFormatter = (timezone) => {
    if (!formatters.has(timezone)) {
        formatters.set(
            timezone,
            new Intl.DateTimeFormat("en-CA", {
                timeZone: timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }),
        );
    }
    return formatters.get(timezone);
};

// True for IANA names such as "Asia/Kolkata"
export const isValidTimezone = (timezone) => {
    if (typeof timezone !== "string" || !timezone || timezone.length > 64) {
        return false;
    }

    try {
        getFormatter(timezone);
        return true;
    } catch {
        return false;
    }
};

/**
 * The calendar date ("YYYY-MM-DD") in a timezone at a given moment.
 */
export const getTodayIn = (timezone, now = new Date()) => {
    const parts = getFormatter(timezone).formatToParts(now);
    const pick = (type) => parts.find((part) => part.type === type).value;

    return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

// True when two zones currently show the same clock time. Covers zones with two names:
// Chrome reports India as "Asia/Calcutta", most other clients as "Asia/Kolkata".
export const showSameTime = (timezoneA, timezoneB, now = new Date()) => {
    const clock = (timezone) =>
        now.toLocaleString("en-CA", {
            timeZone: timezone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });

    return clock(timezoneA) === clock(timezoneB);
};

// Today's date for a user, in their own timezone
export const getUserToday = (user, now = new Date()) =>
    getTodayIn(user?.timezone || DEFAULT_TIMEZONE, now);

// The time of day ("14:05") for a user, in their own timezone
export const getUserClockTime = (user, now = new Date()) =>
    now.toLocaleTimeString("en-GB", {
        timeZone: user?.timezone || DEFAULT_TIMEZONE,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
    });

const toUtcDay = (dateString) => Date.parse(`${dateString}T00:00:00Z`);

// "2026-03-01" minus one day is "2026-02-28". Pure calendar arithmetic, no timezone involved.
export const addDays = (dateString, days) =>
    new Date(toUtcDay(dateString) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Day of the week (0 = Sunday) of a "YYYY-MM-DD" date.
 * Derived from the date itself, so it doesn't depend on the server's timezone.
 */
export const getWeekday = (dateString) =>
    new Date(toUtcDay(dateString)).getUTCDay();

// True if a routine or habit had already been created by that date, in the given timezone.
// Nothing can be due, or missed, on a day before it existed.
export const existedOn = (item, dateString, timezone) =>
    getTodayIn(timezone || DEFAULT_TIMEZONE, item.createdAt) <= dateString;

// True if the habit is meant to be done on that date.
// Weekly habits list their days; an empty list means every day.
export const isHabitScheduledOn = (habit, dateString) =>
    habit.frequency !== "weekly" ||
    habit.targetDays.length === 0 ||
    habit.targetDays.includes(getWeekday(dateString));

// True if the routine is meant to be done on that date
export const isRoutineScheduledOn = (routine, dateString) =>
    routine.isRecurring
        ? routine.recurringDays.includes(getWeekday(dateString))
        : routine.date === dateString;
