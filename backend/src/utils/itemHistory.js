import XPLog from "../models/XPLog.js";
import { addDays, getTodayIn, DEFAULT_TIMEZONE } from "./dateRules.js";

// One routine's or one habit's past: the days it was done, the days it was missed, and its runs.
// The days are read from what was recorded at the time (completion logs and the XP ledger).
// Only the runs look at the item's schedule, as it stands now, to tell a day off from a day missed.

// How many of the most recent days are listed one by one. Totals and runs cover everything.
export const HISTORY_DAYS = 366;

/**
 * The runs of days an item was done on, counting only the days it was due:
 * a habit kept on Mondays and Thursdays is on a run of 6 after three unbroken weeks.
 * A day it was not due neither adds to a run nor ends it, and today cannot end one while it is still open.
 * @param {Object} options
 * @param {Set} options.doneDates - the "YYYY-MM-DD" days it was done
 * @param {Function} options.isDueOn - (date) => whether it was meant to be done that day
 * @param {String} options.firstDay - the day it was created
 * @param {String} options.today
 * @returns {Object} - { current, best }
 */
export const runsOf = ({ doneDates, isDueOn, firstDay, today }) => {
    // Something done before the day the item says it was created still counts
    let start = firstDay;
    for (const date of doneDates) {
        if (date < start) start = date;
    }

    let best = 0;
    let run = 0;

    for (let day = start; day <= today; day = addDays(day, 1)) {
        if (doneDates.has(day)) {
            run += 1;
            if (run > best) best = run;
        } else if (isDueOn(day) && day !== today) {
            run = 0;
        }
    }

    // Walking forwards, whatever run is still standing when today is reached is the current one
    return { current: run, best };
};

/**
 * The days an item was charged for being left undone, from the XP ledger.
 * A miss that cost nothing (there was no XP left to take) left no entry, and so is not here.
 * @returns {Map} - date => XP lost
 */
export const missedDaysOf = async (userId, reason, field, itemId) => {
    const entries = await XPLog.find({
        user: userId,
        reason,
        // The ledger has held the id both as an id and as text
        [`metadata.${field}`]: { $in: [itemId, itemId.toString()] },
    }).select("amount metadata");

    const missed = new Map();
    for (const entry of entries) {
        const date = entry.metadata?.date;
        if (date) missed.set(date, (missed.get(date) ?? 0) - entry.amount);
    }

    return missed;
};

/**
 * Puts an item's history together.
 * @param {Object} options
 * @param {Object} options.user - needs timezone
 * @param {Object} options.item - the routine or habit, for its creation date
 * @param {String} options.today
 * @param {Array} options.recorded - one entry per day something was logged: { date, status, ...extras }.
 *   A status of "done" or "late" counts as done.
 * @param {Map} options.missed - from missedDaysOf
 * @param {Function} options.isDueOn
 * @returns {Object} - today; since: the first day listed; days: oldest first, each { date, status, ... };
 *   totals: { done, late, missed, xpLost } over all time; run: { current, best }
 */
export const buildHistory = ({ user, item, today, recorded, missed, isDueOn }) => {
    const since = addDays(today, -(HISTORY_DAYS - 1));
    const byDate = new Map(recorded.map((entry) => [entry.date, entry]));
    const wasDone = (entry) => entry.status === "done" || entry.status === "late";

    // A day cannot be both: if something was logged for it after all, the log is what happened
    for (const [date, xpLost] of missed) {
        if (!byDate.has(date)) byDate.set(date, { date, status: "missed", xpLost });
    }

    const all = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const doneDates = new Set(all.filter(wasDone).map((entry) => entry.date));

    return {
        today,
        since,
        days: all.filter((entry) => entry.date >= since && entry.date <= today),
        totals: {
            done: doneDates.size,
            late: all.filter((entry) => entry.status === "late").length,
            missed: all.filter((entry) => entry.status === "missed").length,
            xpLost: all.reduce((sum, entry) => sum + (entry.status === "missed" ? entry.xpLost : 0), 0),
        },
        run: runsOf({
            doneDates,
            // A day that was charged as missed ends a run even if the schedule no longer includes it
            isDueOn: (date) => missed.has(date) || isDueOn(date),
            firstDay: getTodayIn(user.timezone || DEFAULT_TIMEZONE, item.createdAt),
            today,
        }),
    };
};
