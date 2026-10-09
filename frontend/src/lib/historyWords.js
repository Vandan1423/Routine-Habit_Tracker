// The words said when looking back: about a day that has ended, a month, a week, how an item has gone,
// and each line of the XP ledger. Kept in one place, like the day's words in lib/dayMessage.js, so that
// screens write none of their own. Everything is worked out from its arguments.
//
// A loss is stated once and plainly: what was left, and what that cost. No word here judges it.

import { addDays, formatDayPlain, formatDayShort } from "./dates";
import { BONUS_LABEL, countWord, named } from "./dayMessage";
import { leftOpenSentence } from "./recap";
import { formatTime } from "./time";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();

const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;
const percent = (share) => `${Math.round(share * 100)}%`;
const days = (count) => `${numberFormat.format(count)}${NBSP}${count === 1 ? "day" : "days"}`;

// A real minus sign, as wide as the plus on a gain
export const signedXp = (amount) =>
    `${amount < 0 ? "−" : "+"}${numberFormat.format(Math.abs(amount))}`;

// Something on record that the account no longer holds
export const namelessWords = (kind) => (kind === "habit" ? "A deleted habit" : "A deleted routine");

const titleOf = (item) => item.title ?? namelessWords(item.kind);

// A run shorter than this is not worth a sentence
const SHORTEST_RUN_WORTH_SAYING = 2;

// ── One ended day ──

/**
 * How an ended day went, as the line under its date.
 * @param {Object} day - from buildPastDay (lib/history.js)
 * @returns {Object} - { lead, rest }
 */
export const pastDayWords = (day) => {
    const ended =
        day.streakEnded >= SHORTEST_RUN_WORTH_SAYING ? `That ended a run of ${days(day.streakEnded)}.` : "";
    const ran = day.perfect && day.run >= SHORTEST_RUN_WORTH_SAYING ? `Day ${day.run} of a run.` : "";

    if (day.total === 0) {
        return { lead: "Nothing was due.", rest: ended };
    }

    if (day.left === 0) {
        return { lead: "Everything done.", rest: ran };
    }

    // Those that still have a name are named first; one that has none is better counted among "the others"
    const left = leftOpenSentence({
        open: day.left,
        names: [...day.open].sort((a, b) => Boolean(b.title) - Boolean(a.title)).map(titleOf),
    });

    return {
        lead: `${day.done} of ${day.total} done.`,
        rest: [left, day.lost > 0 ? `That cost ${xp(day.lost)}.` : "", ran, ended].filter(Boolean).join(" "),
    };
};

/**
 * Under an ended day's list: what was left undone that cannot be named.
 * @param {Number} count - how many
 * @param {Boolean} [alone] - nothing else is listed for the day, so they are not "more"
 */
export const unnamedWords = (count, alone = false) => {
    if (count <= 0) return "";

    const one = count === 1;
    const what = alone ? (one ? "thing was" : "things were") : one ? "more was" : "more were";

    return `${countWord(count)} ${what} left open that day. ${one ? "It" : "They"} cost nothing, so the record does not name ${one ? "it" : "them"}.`;
};

/**
 * What stands beside a name on an ended day: when it was done if it was late, or that it was missed.
 * A count that fell short says so with its numbers, and needs no word.
 * @returns {Object|null} - { text, tone }: tone is "late" or "quiet"
 */
export const pastFlagWords = (item) => {
    if (item.status === "late") {
        return { text: item.completedAt ? `Late, at ${formatTime(item.completedAt)}` : "Late", tone: "late" };
    }
    if (item.status === "missed") return { text: "Missed", tone: "quiet" };
    return null;
};

// How a line of an ended day is read out before its name
export const pastStatusWords = (item) =>
    ({ done: "Done", late: "Done late", partial: "Partly done", missed: "Missed" })[item.status] ?? "";

// The foot of an ended day: what its rows and its bonus came to, less what was taken
export const pastTotalLabel = (day) => (day.lost > 0 ? "The day came to" : "Earned that day");

export const NO_RECORD_WORDS = {
    title: "Nothing on record for this day",
    body: "Nothing was due and nothing was done, or the account was not keeping days yet.",
};

// ── A month ──

/**
 * A month in a sentence, above its calendar.
 * @param {Object} stats - from buildMonth (lib/history.js)
 * @param {Object} [options] - current: the month is still running
 * @returns {Object} - { lead, rest }
 */
export const monthWords = (stats, { current = false } = {}) => {
    if (stats.days === 0) {
        return {
            lead: current ? "No day has closed yet this month." : "Nothing on record this month.",
            rest: current ? "The first one closes at midnight." : "",
        };
    }

    let lead = `${stats.perfect} of ${days(stats.days)} had everything done.`;
    if (stats.perfect === stats.days) {
        lead = stats.days === 1 ? "One day, with everything done." : `Everything done on all ${days(stats.days)}.`;
    } else if (stats.perfect === 0) {
        lead = stats.days === 1 ? "One day on record." : `${countWord(stats.days)} days on record.`;
    }

    const counted = stats.total > 0 ? `${numberFormat.format(stats.done)} of ${numberFormat.format(stats.total)} things done` : "";
    const lost = stats.lost > 0 ? `${xp(stats.lost)} lost to the rest` : "";

    return {
        lead,
        rest: counted ? `${[counted, lost].filter(Boolean).join(", ")}.` : "",
    };
};

// What a day on the month's calendar says when it is read out
export const calendarDayWords = (mark) => {
    if (!mark) return "nothing on record";
    if (mark.total === 0) return "nothing was due";

    const counted = `${mark.done} of ${mark.total} done`;
    if (!mark.settled) return `${counted} so far`;
    return mark.lost > 0 ? `${counted}, ${xp(mark.lost)} lost` : counted;
};

export const HISTORY_LEGEND =
    "Each strip is a day: a mark for everything that was due, filled where it was done. A date in bold had everything done.";

// ── Weeks and months on Insights ──

/**
 * The first thing Insights says: how this week stands against the last.
 * Counts ended days only, so nothing still open today is held against the week.
 * @param {Object} weeks - { thisWeek, lastWeek } from buildInsights (lib/insights.js); lastWeek may be null
 * @returns {Object} - { lead, rest }
 */
export const weekWords = ({ thisWeek, lastWeek }) => {
    const before = lastWeek && lastWeek.total > 0 ? lastWeek : null;

    if (!thisWeek || thisWeek.total === 0) {
        return {
            lead: "A new week.",
            rest: before
                ? `The last one closed at ${before.done} of ${before.total}, ${percent(before.share)}.`
                : "Its first day is still open.",
        };
    }

    const share = percent(thisWeek.share);
    let compared = `That is ${share} of what the days so far asked.`;
    if (before) {
        const last = percent(before.share);
        if (share === last) compared = `That is ${share}, the same as last week.`;
        else compared = `That is ${share}, ${thisWeek.share > before.share ? "up" : "down"} from ${last} last week.`;
    }

    const cost =
        thisWeek.lost > 0
            ? `What was left cost ${xp(thisWeek.lost)}.`
            : thisWeek.done === thisWeek.total
              ? "Nothing was left open."
              : "";

    return {
        lead: `${thisWeek.done} of ${thisWeek.total} done this week.`,
        rest: [compared, cost].filter(Boolean).join(" "),
    };
};

// What a week's row is called: the two nearest by name, the rest by the day they began
export const weekLabel = (start, thisWeekStart) => {
    if (start === thisWeekStart) return "This week";
    if (start === addDays(thisWeekStart, -7)) return "Last week";
    return formatDayShort(start);
};

// A week or a month read out in full, for a row that is otherwise drawn
export const spanWords = (sum) => {
    if (sum.total === 0) return "nothing due";

    const counted = `${sum.done} of ${sum.total} done, ${sum.perfect} of ${days(sum.days)} with everything done`;
    return sum.lost > 0 ? `${counted}, ${xp(sum.lost)} lost` : counted;
};

export const WEEKS_NOTE = "Today is counted once it closes.";

// ── Routines and habits on Insights ──

// "26 of 28" days: how often it was done of the times it was due
export const keptWords = (item) => `${item.done} of ${item.due}`;

// "Missed 6 of 28"
export const leftWords = (item) => `Missed ${item.missed} of ${item.due}`;

// ── The XP ledger ──

const REASONS = {
    routine_complete: (entry) => (entry.late ? "Done late" : "Done"),
    habit_complete: () => "Done",
    routine_uncomplete: () => "Un-ticked",
    habit_uncomplete: () => "Un-ticked",
    routine_missed: () => "Missed",
    habit_missed: () => "Missed",
};

/**
 * One line of the ledger in words.
 * @param {Object} entry - from GET /history/ledger
 * @returns {Object} - { label, note }: what it was for, and what happened
 */
export const ledgerWords = (entry) => {
    if (entry.reason === "perfect_day_bonus") {
        return { label: BONUS_LABEL, note: entry.streak > 1 ? `Day ${entry.streak} of a run` : "" };
    }
    if (entry.reason === "perfect_day_bonus_revoked") {
        return { label: BONUS_LABEL, note: "Taken back" };
    }

    const said = REASONS[entry.reason];
    if (said) {
        return { label: entry.title ? named(entry.title) : namelessWords(entry.kind), note: said(entry) };
    }

    // A reason from before these were named: said as it was written, in plain words
    const plain = String(entry.reason ?? "").replace(/_/g, " ").trim();
    return {
        label: entry.title ? named(entry.title) : plain ? plain.charAt(0).toUpperCase() + plain.slice(1) : "XP",
        note: entry.title ? plain : "",
    };
};

// The heading over a day's lines in the ledger
export const ledgerDayLabel = (date, today) => {
    if (date === today) return "Today";
    if (date === addDays(today, -1)) return `Yesterday, ${formatDayPlain(date)}`;
    return formatDayPlain(date);
};

// ── With nothing to show yet ──

export const NOTHING_YET = {
    insights: {
        title: "Nothing to look back on yet",
        body: "Insights fill in as days close. The first one closes at midnight.",
    },
    history: {
        title: "No day has closed yet",
        body: "Each day takes its place here when it ends, with what was done and what was left.",
    },
};
