// Calendar days. The API writes a day as "YYYY-MM-DD", counted in the account's own timezone,
// and so does every value passed around the app. A day is never turned into a moment in time here:
// the arithmetic is done on the date itself, so no timezone can shift it.

import { firstDayOfWeek } from "./week";

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (day) => Date.parse(`${day}T00:00:00Z`);
const pad = (number) => String(number).padStart(2, "0");

// The day a moment falls on by this device's own clock
export const localDay = (date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// "2026-03-01" and -1 give "2026-02-28"
export const addDays = (day, count) =>
    new Date(toUtc(day) + count * DAY_MS).toISOString().slice(0, 10);

// 0 for Sunday to 6 for Saturday, as the API numbers them
export const weekdayOf = (day) => new Date(toUtc(day)).getUTCDay();

// The names are in English, the language the interface is written in
const titleParts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
});

// "Friday, 9 October": the title of a day
export const formatDayTitle = (day) => {
    const parts = Object.fromEntries(
        titleParts.formatToParts(new Date(toUtc(day))).map(({ type, value }) => [type, value]),
    );

    return `${parts.weekday}, ${parts.day} ${parts.month}`;
};

// "Thursday 8 October": a day named inside a line of text
export const formatDayPlain = (day) => formatDayTitle(day).replace(",", "");

const briefParts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
});

// "Thu 8 Oct": a day in a narrow column
export const formatDayBrief = (day) => briefParts.format(new Date(toUtc(day))).replace(",", "");

const shortParts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// "8 Oct": a day where the weekday is already known, or does not matter
export const formatDayShort = (day) => shortParts.format(new Date(toUtc(day)));

// The seven days of the week `day` is in, starting where this reader's week starts
export const weekOf = (day, firstDay = firstDayOfWeek()) => {
    const daysIn = (weekdayOf(day) - firstDay + 7) % 7;
    const start = addDays(day, -daysIn);

    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

// ── Months, written "YYYY-MM" ──

export const monthOf = (day) => day.slice(0, 7);

// "2026-01" and -1 give "2025-12"
export const addMonths = (month, count) => {
    const [year, number] = month.split("-").map(Number);
    const total = year * 12 + (number - 1) + count;

    return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
};

const daysIn = (month) => {
    const [year, number] = month.split("-").map(Number);
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
};

export const firstDayOf = (month) => `${month}-01`;
export const lastDayOf = (month) => `${month}-${pad(daysIn(month))}`;

const monthParts = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// "October 2026"
export const formatMonth = (month) => monthParts.format(new Date(toUtc(firstDayOf(month))));

const monthNameParts = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

// "October": a month where the year is plain from what is around it
export const formatMonthName = (month) => monthNameParts.format(new Date(toUtc(firstDayOf(month))));

const monthShortParts = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

// "Oct": a month under a mark on a chart
export const formatMonthShort = (month) => monthShortParts.format(new Date(toUtc(firstDayOf(month))));

// Whether a piece of text is a real day ("2026-10-09") or a real month ("2026-10")
export const isDay = (text) =>
    /^\d{4}-\d{2}-\d{2}$/.test(text ?? "") &&
    !Number.isNaN(toUtc(text)) &&
    new Date(toUtc(text)).toISOString().slice(0, 10) === text;

export const isMonth = (text) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text ?? "");

/**
 * A month laid out in weeks, for a calendar: each week is seven entries, a day or null where the
 * week runs outside the month.
 */
export const weeksOf = (month, firstDay = firstDayOfWeek()) => {
    const lead = (weekdayOf(firstDayOf(month)) - firstDay + 7) % 7;
    const cells = [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: daysIn(month) }, (_, index) => `${month}-${pad(index + 1)}`),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
};
