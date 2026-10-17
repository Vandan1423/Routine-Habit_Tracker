// A week drawn as a calendar: a column for each day, the hours down the side, and each thing with a time
// as a block from its start to its end. Everything here is worked out from its arguments; components/week
// draws it. Times are "HH:MM" on a 24-hour clock, as everywhere in the app.

import { fromMinutes, toMinutes } from "./time";

// How long something with no end (or one shorter than this) is drawn, so it can still be read and pressed
export const SHORTEST_MINUTES = 30;
// What a block snaps to when it is carried to another time
export const SNAP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

// The hours the grid shows unless what is on it reaches further, and the fewest it ever shows
const EARLIEST = 6;
const LATEST = 22;
const FEWEST_HOURS = 8;

// Where a thing begins and ends, in minutes from midnight. One that runs past midnight is drawn to midnight.
export const spanOf = ({ start, end }) => {
    const from = toMinutes(start);
    const until = end ? toMinutes(end) : from + SHORTEST_MINUTES;
    const to = until > from ? until : DAY_MINUTES;

    return { from, to: Math.min(Math.max(to, from + SHORTEST_MINUTES), DAY_MINUTES) };
};

/**
 * The hours to draw: from six in the morning to ten at night, widened to take in everything on the grid,
 * or the whole day when asked.
 * @param {Array} events - [{ start, end }]
 * @returns {Object} - { from, to }: whole hours, 0 to 24
 */
export const gridRange = (events, { whole = false } = {}) => {
    if (whole) return { from: 0, to: 24 };

    let from = EARLIEST;
    let to = LATEST;
    for (const event of events) {
        const span = spanOf(event);
        from = Math.min(from, Math.floor(span.from / 60));
        to = Math.max(to, Math.ceil(span.to / 60));
    }
    while (to - from < FEWEST_HOURS) {
        if (to < 24) to += 1;
        else from -= 1;
    }

    return { from: Math.max(from, 0), to: Math.min(to, 24) };
};

/**
 * Where each of one day's things sits. Things whose times overlap share the column side by side, each in
 * a lane of its own: in order of their start (the longer first where two start together), each takes the
 * first lane free by then, and every thing in a run of overlaps is as wide as that run has lanes.
 * @param {Array} events - one day's [{ key, start, end }]
 * @returns {Map} - key => { from, to (minutes from midnight), lane, lanes }
 */
export const placeEvents = (events) => {
    const spans = events
        .map((event) => ({ key: event.key, ...spanOf(event) }))
        .sort((a, b) => a.from - b.from || b.to - a.to);
    const placed = new Map();

    let run = [];
    let runEnds = -1;
    let laneEnds = [];
    const closeRun = () => {
        for (const span of run) placed.set(span.key, { ...placed.get(span.key), lanes: laneEnds.length });
        run = [];
        laneEnds = [];
    };

    for (const span of spans) {
        if (span.from >= runEnds) {
            closeRun();
            runEnds = -1;
        }

        let lane = laneEnds.findIndex((end) => end <= span.from);
        if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(span.to);
        } else {
            laneEnds[lane] = span.to;
        }

        placed.set(span.key, { from: span.from, to: span.to, lane });
        run.push(span);
        runEnds = Math.max(runEnds, span.to);
    }
    closeRun();

    return placed;
};

/**
 * Which pairs of one day's things overlap, for saying so in words beside the grid
 * @param {Array} events - one day's [{ key, start, end, title }]
 * @returns {Array} - [[a, b]] in the order they start
 */
export const overlapsIn = (events) => {
    const sorted = [...events].sort((a, b) => spanOf(a).from - spanOf(b).from);
    const pairs = [];

    sorted.forEach((event, index) => {
        const span = spanOf(event);
        for (const other of sorted.slice(index + 1)) {
            const next = spanOf(other);
            if (next.from >= span.to) break;
            pairs.push([event, other]);
        }
    });

    return pairs;
};

// The time a point down a day's column stands for: `offset` minutes below the top of the grid, which
// starts at hour `from`, to the nearest `snap` minutes, kept inside the day
export const timeAt = (offset, from, snap = SNAP_MINUTES) => {
    const minutes = Math.round((from * 60 + offset) / snap) * snap;
    return fromMinutes(Math.min(Math.max(minutes, 0), DAY_MINUTES - snap));
};

// A thing carried `minutes` later (or earlier, below zero), keeping how long it lasts. Nothing is moved
// across midnight: it stops at the first or the last place the day has room for it.
export const shifted = ({ start, end }, minutes) => {
    const from = toMinutes(start);
    const length = end ? (toMinutes(end) - from + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES : 0;
    // Its end no later than a quarter to midnight, so that it never reads as the next day's
    const latest = DAY_MINUTES - SNAP_MINUTES - length;
    const moved = Math.min(Math.max(Math.round((from + minutes) / SNAP_MINUTES) * SNAP_MINUTES, 0), latest);

    return { start: fromMinutes(moved), end: end ? fromMinutes(moved + length) : null };
};
