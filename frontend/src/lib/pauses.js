// Pauses: the stretches of days a routine or habit is off (a trip, an illness). The API keeps them on the item
// as `pauses`, [{ from, until }], both days "YYYY-MM-DD" and both included; the days it spent in Archive are
// kept the same way. These are the server's own rules (backend/src/utils/itemPause.js), worked out here so a
// change can be shown before the server has answered.

import { addDays } from "./dates";

// How long a pause can be asked for at most, in days
export const MOST_PAUSE_DAYS = 365;

// Whether an item is off on a day
export const isPausedOn = (item, date) =>
    (item?.pauses ?? []).some((pause) => pause.from <= date && date <= pause.until);

// The pause that covers today or is still to come, if any: { from, until }
export const pauseAhead = (item, today) =>
    (item?.pauses ?? []).find((pause) => pause.until >= today) ?? null;

/**
 * The pauses with nothing left from `day` on: one that runs past it ends the day before,
 * one that had not started by then is dropped. What ending a pause early does.
 */
export const endPausesFrom = (pauses, day) =>
    (pauses ?? [])
        .filter((pause) => pause.from < day)
        .map((pause) => (pause.until >= day ? { ...pause, until: addDays(day, -1) } : pause));

/**
 * The pauses once a new one is set from `from` for `days` days: it replaces whatever was left of one already set.
 */
export const withPause = (pauses, { from, days }, today) => [
    ...endPausesFrom(pauses, today),
    { from, until: addDays(from, days - 1) },
];
