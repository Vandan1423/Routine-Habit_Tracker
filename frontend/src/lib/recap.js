// The recap: what was settled when a day closed. A loss is reported here once, plainly, and followed by the
// way forward; after that it lives in the XP ledger. Everything is worked out from its arguments.

import { addDays, formatDayBrief, formatDayPlain } from "./dates";
import { tallyOf } from "./day";
import { countWord, named } from "./dayMessage";

// The server looks back this many ended days (streakController.js)
const LOOK_BACK_DAYS = 7;
// A run shorter than this ending is not worth a sentence
const SHORTEST_RUN_WORTH_SAYING = 2;
// How many of the things left open are named before the rest are counted
const MOST_NAMES = 2;

/**
 * Which ended days the recap covers today. This browser remembers the day it last showed a recap and what
 * that one covered: the same recap stays for the rest of that day, and the next day's reports only what has
 * ended since. Seen for the first time, it covers yesterday alone.
 * @param {Object|null} remembered - { day, from, dismissed } as last stored
 * @param {String} today - "YYYY-MM-DD"
 * @returns {Object} - { day: today, from: the earliest day covered, dismissed }
 */
export const recapWindow = (remembered, today) => {
    if (remembered?.day === today) return remembered;

    const oldest = addDays(today, -LOOK_BACK_DAYS);
    const since = remembered?.day && remembered.day < today ? remembered.day : addDays(today, -1);

    return { day: today, from: since > oldest ? since : oldest, dismissed: false };
};

const listed = (names) => {
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

// "Journal was left open." Names what it can, and counts the rest.
export const leftOpenSentence = ({ open, names }) => {
    if (open <= 0) return "";

    const shown = names.slice(0, open > MOST_NAMES ? MOST_NAMES : open).map(named);
    const others = open - shown.length;

    if (shown.length === 0) {
        return `${countWord(open)} ${open === 1 ? "was" : "were"} left open.`;
    }

    const parts = others > 0 ? [...shown, `${countWord(others).toLowerCase()} ${others === 1 ? "other" : "others"}`] : shown;
    return `${listed(parts)} ${open === 1 ? "was" : "were"} left open.`;
};

const entryOf = (day) => {
    const { total, done } = tallyOf(day);

    return {
        date: day.date,
        total,
        done,
        open: total - done,
        names: (day.missed ?? []).map((item) => item.title).filter(Boolean),
        loss: day.xpLost ?? 0,
        runEnded: day.streakEnded >= SHORTEST_RUN_WORTH_SAYING ? day.streakEnded : 0,
    };
};

const worthReporting = (entry) => entry.open > 0 || entry.loss > 0 || entry.runEnded > 0;

const FORWARD = "Today can start the next one.";

const oneDay = (entry, today) => {
    const name = formatDayPlain(entry.date);
    const sentences = [];

    if (entry.total > 0) {
        sentences.push(`${entry.done} of ${entry.total} done.`, leftOpenSentence(entry));
        if (entry.runEnded) sentences.push(`That ended a run of ${entry.runEnded} days. ${FORWARD}`);
    } else if (entry.runEnded) {
        sentences.push(`Nothing was planned, which ended a run of ${entry.runEnded} days. ${FORWARD}`);
    }

    return {
        label: entry.date === addDays(today, -1) ? `Yesterday, ${name}` : name,
        text: sentences.filter(Boolean).join(" "),
        loss: entry.loss,
        rows: [],
    };
};

const severalDays = (entries) => {
    const open = entries.reduce((sum, entry) => sum + entry.open, 0);
    const ended = entries.find((entry) => entry.runEnded);
    const sentences = [
        `${countWord(entries.length)} days closed with ${open} ${open === 1 ? "thing" : "things"} left open.`,
    ];

    if (ended) sentences.push(`A run of ${ended.runEnded} days ended. ${FORWARD}`);

    return {
        label: "Since your last visit",
        text: sentences.join(" "),
        loss: entries.reduce((sum, entry) => sum + entry.loss, 0),
        rows: entries.map((entry) => ({
            date: entry.date,
            label: formatDayBrief(entry.date),
            total: entry.total,
            done: entry.done,
            loss: entry.loss,
        })),
    };
};

/**
 * Builds the recap to show, from the ended days the API reports (GET /streaks/recap).
 * @param {Array} days - newest first, each with its totals, `missed`, `xpLost` and `streakEnded`
 * @param {Object} window - from recapWindow
 * @returns {Object|null} - { label, text, loss, rows }; rows is one line per day when several are covered.
 *   null when there is nothing to report: no day in the window lost anything.
 */
export const buildRecap = (days = [], { day: today, from }) => {
    const entries = days
        .filter((day) => day.date >= from && day.date < today)
        .map(entryOf)
        .filter(worthReporting);

    if (entries.length === 0) return null;
    return entries.length === 1 ? oneDay(entries[0], today) : severalDays(entries);
};
