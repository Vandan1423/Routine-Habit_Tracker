// Times of day. The API keeps them as "HH:MM" on a 24-hour clock ("07:30", "19:05"), and so does every
// value passed around the app. These helpers turn that into what a person reads and types, and back.

const MINUTES_IN_DAY = 24 * 60;
const NBSP = " "; // keeps "7:30" and "am" on one line

// True where the reader's own locale writes times with am and pm
export const uses12HourClock = () => {
    const { hour12, hourCycle } = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
    }).resolvedOptions();

    return hour12 ?? (hourCycle === "h11" || hourCycle === "h12");
};

export const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

export const fromMinutes = (total) => {
    const minutes = ((total % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const pad = (number) => String(number).padStart(2, "0");
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
};

// "19:30" becomes "7:30 pm", or "19:30" where the clock has 24 hours. An empty time stays empty.
export const formatTime = (time, { hour12 = uses12HourClock() } = {}) => {
    if (!time) return "";

    const minutes = toMinutes(time);
    const hours = Math.floor(minutes / 60);
    const rest = String(minutes % 60).padStart(2, "0");

    if (!hour12) return `${hours}:${rest}`;
    return `${hours % 12 || 12}:${rest}${NBSP}${hours < 12 ? "am" : "pm"}`;
};

// "2:00 to 4:00 pm". Both halves of the day are written only when they differ: "11:30 am to 12:15 pm".
// With no end, just the start.
export const formatTimeRange = (start, end, { hour12 = uses12HourClock() } = {}) => {
    if (!start) return "";
    if (!end) return formatTime(start, { hour12 });

    const sameHalf = toMinutes(start) < 12 * 60 === toMinutes(end) < 12 * 60;
    const from =
        hour12 && sameHalf
            ? formatTime(start, { hour12 }).split(NBSP)[0]
            : formatTime(start, { hour12 });

    return `${from} to ${formatTime(end, { hour12 })}`;
};

// "am", "p", "p.m." and the like, or nothing
const HALF = String.raw`(?:([ap])\.?(?:m\.?)?)?`;
const TIME_PATTERN = new RegExp(String.raw`^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*${HALF}$`);
// A time that is still being typed: with a separator ("7:", "7:3"), or digits alone ("73")
const SEPARATED_START = new RegExp(String.raw`^(\d{1,2})[:.\s](\d{0,2})\s*${HALF}$`);
const DIGITS_START = new RegExp(String.raw`^(\d{1,4})\s*${HALF}$`);

/**
 * Reads a time the way people type one, and returns it as "HH:MM", or null if it is not a time.
 * "7", "730", "7:30", "7.30 pm", "7p", "19:30", "noon" and "midnight" are all understood.
 * Without am or pm, the hour is taken as written: "7" is the morning, "19" the evening.
 */
export const parseTime = (text) => {
    const typed = String(text).trim().toLowerCase().replaceAll(NBSP, " ");

    if (typed === "noon") return "12:00";
    if (typed === "midnight") return "00:00";

    const match = TIME_PATTERN.exec(typed);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    const half = match[3];

    if (minutes > 59 || hours > 23) return null;

    if (half) {
        if (hours > 12) return null; // "15 pm" is not a time anyone means
        if (half === "p" && hours < 12) hours += 12;
        if (half === "a" && hours === 12) hours = 0;
    }

    return fromMinutes(hours * 60 + minutes);
};

// Every time of day, `step` minutes apart, from midnight
export const timesOfDay = (step = 30) =>
    Array.from({ length: Math.floor(MINUTES_IN_DAY / step) }, (_, index) =>
        fromMinutes(index * step),
    );

// The ways the start of a typed time can be read, each as [hour, start of the minutes].
// "7" is hour 7. "73" can only be 7:3_. "100" may be 1:00 or the start of 10:0_. Anything else has no reading.
const readStart = (typed) => {
    const separated = SEPARATED_START.exec(typed);
    if (separated) return [[Number(separated[1]), separated[2]]];

    const digits = DIGITS_START.exec(typed)?.[1] ?? "";
    const readings = [1, 2]
        .filter((cut) => digits.length >= cut)
        .map((cut) => [Number(digits.slice(0, cut)), digits.slice(cut)])
        .filter(([hour, minutes]) => hour <= 23 && minutes.length <= 2 && !(minutes[0] > 5));

    // Digits that are a whole hour on their own ("10") are read as that hour and nothing else
    const wholeHour = readings.find(([, minutes]) => minutes === "");
    return wholeHour ? [wholeHour] : readings;
};

/**
 * The times to offer for what has been typed so far, in clock order.
 * Nothing typed: every `step` minutes of the day.
 * "715" on a 12-hour clock: 7:15 am and 7:15 pm, so the half of the day can be picked without typing it.
 * "7": 7:00 and 7:30, morning and evening. "7p": the evening ones only.
 */
export const suggestTimes = (text, { step = 30, hour12 = uses12HourClock() } = {}) => {
    const typed = String(text).trim().toLowerCase().replaceAll(NBSP, " ");
    const grid = timesOfDay(step);
    if (!typed) return grid;

    const half = /\d\s*([ap])/.exec(typed)?.[1];
    const found = new Set();
    const exact = parseTime(typed);

    if (exact) {
        found.add(exact);
        // An hour from 1 to 12 does not say which half of the day: offer the same time in the other half too
        const minutes = toMinutes(exact);
        if (hour12 && /^\d/.test(typed) && !half && minutes >= 60 && minutes < 13 * 60) {
            found.add(fromMinutes(minutes + 12 * 60));
        }
    }

    // What was typed may be the start of a longer time: offer the ones on the list that begin the same way
    const readings = readStart(typed);
    for (const time of grid) {
        const [hours, minutes] = time.split(":");
        const hours24 = Number(hours);
        const inHalf = !half || (half === "p") === hours24 >= 12;

        const begins = readings.some(
            ([hour, minuteStart]) =>
                (hour === hours24 || (hour12 && hour === (hours24 % 12 || 12))) &&
                minutes.startsWith(minuteStart),
        );
        if (inHalf && begins) found.add(time);
    }

    return [...found].sort();
};

// The time on the list nearest to `time`, for scrolling a long list to where the reader is
export const nearestTime = (time, times) => {
    if (times.length === 0) return null;

    const target = toMinutes(time);
    return times.reduce((best, candidate) =>
        Math.abs(toMinutes(candidate) - target) < Math.abs(toMinutes(best) - target)
            ? candidate
            : best,
    );
};
