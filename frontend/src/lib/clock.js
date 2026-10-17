// The clock face a time is picked on: where each number sits on the dial, which number a press lands on,
// and how digits typed into the hour and the minute are read. Times are "HH:MM" on a 24-hour clock, as
// everywhere else in the app (see lib/time.js); a draft is { hours: 0 to 23, minutes: 0 to 59 }.

import { fromMinutes, toMinutes } from "./time";

// The minutes the dial offers. Any other minute can still be typed.
export const MINUTE_STEP = 5;

// Where the inner ring of a 24-hour dial ends and the outer ring begins, as a share of the dial's radius
const INNER_RING = 0.62;

export const draftOf = (time) => {
    const total = toMinutes(time);
    return { hours: Math.floor(total / 60), minutes: total % 60 };
};

export const timeOf = ({ hours, minutes }) => fromMinutes(hours * 60 + minutes);

// The time a field with nothing in it opens on: `at` when it is given, or the next five minutes from now
export const startingDraft = (at, now = new Date()) => {
    if (at) return draftOf(at);

    const next = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / MINUTE_STEP) * MINUTE_STEP;
    return draftOf(fromMinutes(next));
};

/**
 * The numbers round the dial, each with its place as a share of the dial's width and height from the
 * top left corner (0.5, 0.5 is the middle), clockwise from the top.
 * hours on a 12-hour clock: 12, 1 to 11. On a 24-hour clock: 12, 1 to 11 outside, 00, 13 to 23 inside.
 * minutes: 00 to 55, in fives.
 * @returns {Array} - [{ value, label, x, y, inner }]
 */
export const dialNumbers = (view, { hour12 }) => {
    const at = (index, radius) => {
        const angle = (index / 12) * 2 * Math.PI;
        return { x: 0.5 + radius * Math.sin(angle), y: 0.5 - radius * Math.cos(angle) };
    };

    if (view === "minutes") {
        return Array.from({ length: 12 }, (_, index) => ({
            value: index * MINUTE_STEP,
            label: String(index * MINUTE_STEP).padStart(2, "0"),
            inner: false,
            ...at(index, 0.4),
        }));
    }

    const outer = Array.from({ length: 12 }, (_, index) => ({
        // In the morning on a 12-hour clock; the half of the day is chosen beside the dial
        value: index === 0 ? 12 : index,
        label: String(index === 0 ? 12 : index),
        inner: false,
        ...at(index, 0.4),
    }));
    if (hour12) return outer;

    const inner = Array.from({ length: 12 }, (_, index) => ({
        value: index === 0 ? 0 : index + 12,
        label: index === 0 ? "00" : String(index + 12),
        inner: true,
        ...at(index, 0.26),
    }));
    return [...outer, ...inner];
};

/**
 * What a press on the dial chooses, from where it landed: x and y as shares of the dial's width and height.
 * @returns {Number|null} - for hours, the hour of the day (0 to 23) keeping the half of the day `draft` is in on
 *   a 12-hour clock; for minutes, the minute, to the nearest five. Null for a press on the very middle.
 */
export const valueAt = (view, x, y, { hour12, draft }) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.06) return null;

    // Clockwise from the top, 0 to 1 of the way round
    const turn = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;

    if (view === "minutes") return (Math.round(turn * 12) % 12) * MINUTE_STEP;

    const index = Math.round(turn * 12) % 12;
    if (hour12) return (draft.hours >= 12 ? 12 : 0) + index;
    // Outside: 12 and 1 to 11. Inside: 00 and 13 to 23.
    if (distance / 0.5 < INNER_RING) return index === 0 ? 0 : index + 12;
    return index === 0 ? 12 : index;
};

// The hand's angle in degrees, clockwise from the top, and whether it reaches the inner ring
export const handOf = (view, draft, { hour12 }) => {
    if (view === "minutes") return { angle: (draft.minutes / 60) * 360, inner: false };

    const inner = !hour12 && (draft.hours === 0 || draft.hours > 12);
    return { angle: ((draft.hours % 12) / 12) * 360, inner };
};

// Whether a number on the dial is the one the draft holds
export const isChosen = (view, number, draft, { hour12 }) => {
    if (view === "minutes") return number.value === draft.minutes;
    if (hour12) return number.value === (draft.hours % 12 || 12);
    return number.value === draft.hours;
};

// The hour as the hour box shows it: 1 to 12 with am and pm beside it, or 0 to 23
export const shownHour = (hours, { hour12 }) => String(hour12 ? hours % 12 || 12 : hours).padStart(2, "0");

export const withHalf = (draft, half) => ({
    ...draft,
    hours: (draft.hours % 12) + (half === "pm" ? 12 : 0),
});

export const halfOf = (draft) => (draft.hours >= 12 ? "pm" : "am");

/**
 * One digit typed into the hour box.
 * pending: the digit typed just before it, while that one could still be the start of a longer hour, or null.
 * @returns {Object} - { hours, pending, done }: the hour of the day now held, the digit still waiting for
 *   another one (null when none), and whether the hour is complete and the cursor can move on to the minutes
 */
export const typeHourDigit = (digit, pending, draft, { hour12 }) => {
    const half = draft.hours >= 12 ? 12 : 0;
    const of12 = (hour) => (hour % 12) + half;

    if (pending !== null) {
        const both = pending * 10 + digit;
        if (hour12 && both >= 1 && both <= 12) return { hours: of12(both), pending: null, done: true };
        if (!hour12 && both <= 23) return { hours: both, pending: null, done: true };
        // Not an hour together: the new digit starts again on its own
        return typeHourDigit(digit, null, draft, { hour12 });
    }

    // A digit that no second digit could follow is a whole hour by itself
    const highest = hour12 ? 1 : 2;
    if (digit > highest) return { hours: hour12 ? of12(digit) : digit, pending: null, done: true };

    // 0 on a 12-hour clock is no hour yet, and waits for the next digit
    if (hour12 && digit === 0) return { hours: draft.hours, pending: 0, done: false };
    return { hours: hour12 ? of12(digit) : digit, pending: digit, done: false };
};

// One digit typed into the minute box: as for the hour, 0 to 59
export const typeMinuteDigit = (digit, pending) => {
    if (pending !== null) return { minutes: pending * 10 + digit, pending: null, done: true };
    if (digit > 5) return { minutes: digit, pending: null, done: true };
    return { minutes: digit, pending: digit, done: false };
};

// The hour or minute one step up or down (by the arrow keys), going round
export const stepDraft = (draft, view, direction) => {
    if (view === "minutes") return { ...draft, minutes: (draft.minutes + direction + 60) % 60 };
    return { ...draft, hours: (draft.hours + direction + 24) % 24 };
};
