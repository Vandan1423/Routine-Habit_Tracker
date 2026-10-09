// How things have gone, worked out for the Insights screen: weeks and months from the day summaries,
// which routines and habits were kept and which were left, and the XP ledger day by day.
// Everything here is worked out from its arguments.

import { addDays, addMonths, firstDayOf, monthOf, weekOf } from "./dates";
import { tallyOf } from "./day";
import { sumDays } from "./history";

// How far back each part of the screen looks
export const WEEKS_SHOWN = 8;
export const MONTHS_SHOWN = 6;
export const ITEM_DAYS = 28;

// How many items each of the two lists names, and how often one must have been due to be ranked at all
const MOST_RANKED = 3;
const FEWEST_DUE = 3;

// The days to ask the API for: from the first of the month five months back, up to today
export const insightRange = (today) => ({
    from: firstDayOf(addMonths(monthOf(today), -(MONTHS_SHOWN - 1))),
    to: today,
});

// The ended days the items are ranked over: the four weeks before today
export const itemRange = (today) => ({ from: addDays(today, -ITEM_DAYS), to: addDays(today, -1) });

/**
 * Weeks and months from the day summaries.
 * Sums count ended days only: today joins them when it closes. In a week's row of days, though, today is
 * drawn as it stands.
 * @param {Object} parts
 * @param {Array} parts.days - what GET /history/days answers for insightRange
 * @param {String|null} parts.since - the first day the account has a summary for
 * @param {String} parts.today
 * @param {Object} [parts.live] - { total, done } as today stands right now
 * @param {Number} [parts.firstDay] - the day the reader's week starts on
 * @returns {Object} - empty: nothing has closed yet;
 *   weeks: newest first, each { start, cells: seven of { date, total, done, settled } or null, ...sumDays };
 *   months: newest first, each { month, ...sumDays }; recent: the sums of the last four weeks
 */
export const buildInsights = ({ days = [], since = null, today, live, firstDay }) => {
    const ended = days.filter((day) => day.date < today);
    const byDate = new Map(ended.map((day) => [day.date, day]));
    const thisWeek = weekOf(today, firstDay);

    const weeks = [];
    for (let back = 0; back < WEEKS_SHOWN; back += 1) {
        const dates = thisWeek.map((date) => addDays(date, -7 * back));
        // Nothing to show for a week that ended before the account's first day
        if (back > 0 && (!since || dates[6] < since)) break;

        const closed = dates.map((date) => byDate.get(date)).filter(Boolean);
        weeks.push({
            start: dates[0],
            cells: dates.map((date) => {
                if (date === today) return live ? { date, total: live.total, done: live.done, settled: false } : null;

                const tally = tallyOf(byDate.get(date));
                return tally ? { date, total: tally.total, done: tally.done, settled: true } : null;
            }),
            ...sumDays(closed),
        });
    }

    const months = [...new Set(ended.map((day) => monthOf(day.date)))]
        .sort()
        .reverse()
        .slice(0, MONTHS_SHOWN)
        .map((month) => ({ month, ...sumDays(ended.filter((day) => monthOf(day.date) === month)) }));

    const recentFrom = addDays(today, -ITEM_DAYS);

    return {
        empty: ended.length === 0,
        weeks,
        months,
        recent: sumDays(ended.filter((day) => day.date >= recentFrom)),
    };
};

/**
 * Which routines and habits were kept most, and which were left most often.
 * How often something was due is how often it was done plus how often it was charged as missed.
 * @param {Array} items - what GET /history/items answers
 * @returns {Object} - { kept, left }: up to three each, of { key, kind, id, title, active, done, missed, due, share, xpLost }.
 *   Nothing is in both lists, and nothing is in `kept` that was left more often than it was done.
 */
export const rankItems = (items = []) => {
    const ranked = items
        .map((item) => {
            const due = item.done + item.missed;
            return { ...item, key: `${item.kind}:${item.id}`, due, share: due > 0 ? item.done / due : 0 };
        })
        .filter((item) => item.due >= FEWEST_DUE);

    const left = ranked
        .filter((item) => item.missed > 0)
        .sort((a, b) => b.missed - a.missed || b.xpLost - a.xpLost || a.share - b.share)
        .slice(0, MOST_RANKED);
    const named = new Set(left.map((item) => item.key));

    const kept = ranked
        .filter((item) => !named.has(item.key) && item.share >= 0.5)
        .sort((a, b) => b.share - a.share || b.due - a.due)
        .slice(0, MOST_RANKED);

    return { kept, left };
};

/**
 * The ledger's entries gathered under the day each belongs to, newest day first.
 * A penalty belongs to the day it was for, though it was written the morning after.
 * @param {Array} entries - from GET /history/ledger, any number of pages together
 * @returns {Array} - each { date, net, entries }, with a day's entries newest first
 */
export const groupLedger = (entries = []) => {
    const groups = new Map();

    for (const entry of entries) {
        if (!groups.has(entry.date)) groups.set(entry.date, { date: entry.date, net: 0, entries: [] });

        const group = groups.get(entry.date);
        group.net += entry.amount;
        group.entries.push(entry);
    }

    const newestFirst = (a, b) => Date.parse(b.at) - Date.parse(a.at) || String(b.id).localeCompare(String(a.id));

    return [...groups.values()]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((group) => ({ ...group, entries: group.entries.sort(newestFirst) }));
};

// Pages of the ledger put together: each entry once, whichever pages it came in on
export const mergeLedger = (...pages) => {
    const seen = new Map();
    for (const entry of pages.flat()) {
        if (entry && !seen.has(entry.id)) seen.set(entry.id, entry);
    }
    return [...seen.values()];
};
