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
