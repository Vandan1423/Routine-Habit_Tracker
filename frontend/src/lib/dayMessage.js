// The words on Today that depend on how the day stands: the line under the date, and what is said when
// something is completed, reopened or reached. Everything here is worked out from its arguments, so the same
// day at the same minute always reads the same. Components ask for words here and write none of their own.

import { lateWorth } from "./day";
import { formatTime, toMinutes } from "./time";

const NBSP = "\u00a0";
const numberFormat = new Intl.NumberFormat();

const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

// "Three" for 3; past ten, the figure
export const countWord = (count) => WORDS[count] ?? numberFormat.format(count);
const lowerWord = (count) => countWord(count).toLowerCase();

const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;

export const greetingAt = (date) => {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
};

// A name inside a sentence is kept short enough for the sentence to stay one: cut at a word, with an ellipsis
const LONGEST_NAME = 36;

export const named = (title) => {
    if (title.length <= LONGEST_NAME) return title;

    const cut = title.slice(0, LONGEST_NAME);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > LONGEST_NAME / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
};

// ── The line under the date ──

// The stretch of the day the clock is in. After nine the day is closing; the small hours belong to the new day.
const phaseAt = (minutes) => {
    if (minutes < 12 * 60) return "morning";
    if (minutes < 17 * 60) return "afternoon";
    if (minutes < 21 * 60) return "evening";
    return "night";
};

// One of a few ways of saying the same thing, chosen by the date: it differs from day to day and never within one
const pick = (choices, date = "") => {
    const seed = [...date].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return choices[seed % choices.length];
};

const nextSentence = (next, nowMinutes) => {
    if (!next) return "";

    const { item, state } = next;
    const name = named(item.title);

    if (state === "now") return `${name} is under way.`;
    if (state === "soon") return `${name} starts in ${next.inMinutes}${NBSP}min.`;
    if (item.start !== null && toMinutes(item.start) > nowMinutes) {
        return `${name} is next, at ${formatTime(item.start)}.`;
    }
    return `${name} is next.`;
};

// How the day opens, before anything is ticked. In the morning it starts from how yesterday ended.
const openingLead = (phase, { date, yesterday, streak }) => {
    if (phase === "afternoon") return "Nothing ticked yet.";
    if (phase !== "morning") return "The day is still open.";

    if (yesterday?.perfect && streak?.current >= 3) {
        return `${countWord(streak.current)} days in a row.`;
    }
    if (yesterday && yesterday.total > 0) {
        // What was lost yesterday is in the recap above; this line is the way forward
        return yesterday.done >= yesterday.total ? "Yesterday closed complete." : "A new day.";
    }
    return pick(["A fresh page.", "The day is open."], date);
};

// Late in the day, what is still at stake: the run of days, which everything still open has to keep going
const runAtStake = (day, streak) => {
    if (!streak || streak.current < 2 || day.left === 0) return null;

    const things = day.left === 1 ? "one more thing" : `${lowerWord(day.left)} more things`;
    return `The ${streak.current}-day run needs ${things}.`;
};

// The line under the date while the last tick of the day is still on its way to the server: the count
// already reads whole, and "Today is complete" is not said until the server has taken it
export const SAVING_LAST_WORDS = { lead: "All ticked.", rest: "Saving the last one." };

/**
 * The line under the date: how the day stands, then what to turn to. It follows the time of day,
 * how much is done, and (first thing in the morning) how yesterday ended.
 * @param {Object} day - from buildDay
 * @param {Object} context
 * @param {Number} context.nowMinutes - minutes since midnight
 * @param {String} [context.date] - today, "YYYY-MM-DD"
 * @param {Object} [context.yesterday] - { total, done, perfect } from tallyOf, or null if there is no record
 * @param {Object} [context.streak] - { current, best }
 * @returns {Object|null} - { lead, rest }: lead is said with more weight. null for a day with nothing in it.
 */
export const dayMessage = (day, { nowMinutes, date, yesterday = null, streak = null } = {}) => {
    const { total, done, left, next } = day;

    if (total === 0) return null;

    const phase = phaseAt(nowMinutes);

    if (left === 0) {
        const early = phase === "morning" || phase === "afternoon";
        return {
            lead: "Today is complete.",
            rest: early ? "The rest of the day is yours." : "Everything you planned is done.",
        };
    }
    if (left === 1) {
        return { lead: "One left.", rest: `${named(next.item.title)} closes the day.` };
    }
    if (phase === "night") {
        return {
            lead: `${countWord(left)} still open.`,
            rest: runAtStake(day, streak) ?? "The day closes at midnight.",
        };
    }

    const rest = nextSentence(next, nowMinutes);

    // The part of the day the clock is in has just been finished, with more of the day to come
    const finished = day.blocks.find((block) => block.current && block.sealed);
    if (finished) return { lead: `${finished.label} is complete.`, rest };

    if (done === 0) return { lead: openingLead(phase, { date, yesterday, streak }), rest };
    if (done * 2 === total) return { lead: "Half the day is done.", rest };
    if (done * 2 > total) return { lead: `${countWord(left)} to go.`, rest };
    return { lead: `${countWord(done)} done.`, rest };
};

/**
 * The line under the streak. It says what the number counts, because that is not obvious:
 * a day joins the streak when everything due that day was done, routines and habits alike.
 * A day with nothing due neither adds to it nor ends it.
 */
export const streakNote = (current, best) => {
    if (current <= 0) {
        const start = "A day with everything done starts one.";
        return best > 0 ? `${start} Your best is ${best}.` : start;
    }

    const counts = "Days in a row with everything done.";
    if (best > current) return `${counts} Your best is ${best}.`;
    return current > 1 ? `${counts} Your longest so far.` : counts;
};

// ── What is said when something happens ──

// Something was completed and the server has taken it: its name, and what it paid
export const completionWords = ({ title, late, earned }) => ({
    message: `${named(title)} done${late ? " late" : ""}`,
    detail: `+${xp(earned)}`,
});

/**
 * The question asked before a routine that was done in time is un-ticked after its deadline:
 * ticking it again would be counted from the clock as it then stands, and pay half.
 * @param {Object} item - a routine from buildDay
 */
export const reopenWords = (item) => ({
    title: `Reopen ${named(item.title)}?`,
    description: `It was done on time and paid ${xp(item.xp)}. Its time has passed since, so ticking it again today would count as late and pay ${numberFormat.format(lateWorth(item.worth))}.`,
    confirm: "Reopen it",
    cancel: "Keep it done",
});

// The line in the day's total for the bonus a day with everything done is paid
export const BONUS_LABEL = "Everything done";

/**
 * What was moved to Trash today while it was still due: tonight counts it as missed all the same.
 * @param {Array} owed - from GET /streaks/info: [{ title, xp }]
 */
export const owedWords = (owed) => {
    const cost = xp(owed.reduce((sum, item) => sum + item.xp, 0));

    if (owed.length === 1) {
        return `${named(owed[0].title)} was deleted today while it was still due. Tonight counts it as missed, ${cost}, unless it is recovered and done.`;
    }
    return `${countWord(owed.length)} things were deleted today while they were still due. Tonight counts them as missed, ${cost}, unless they are recovered and done.`;
};

// Under a finished day: where tomorrow begins. `first` is { title, start } from firstRoutineOf.
export const tomorrowWords = (first) =>
    first ? `Tomorrow starts with ${named(first.title)} at ${formatTime(first.start)}.` : "";

// Midnight went by with the screen open
export const NEW_DAY_WORDS = "A new day has started.";

export const levelWords = (level) => `Level ${numberFormat.format(level)}`;

// The runs of days that are marked when they are reached
export const STREAK_MILESTONES = [7, 14, 30, 100];

const MILESTONES = {
    7: { title: "Seven days in a row", body: "A full week with everything done." },
    14: { title: "Fourteen days in a row", body: "Two weeks with nothing left open." },
    30: { title: "Thirty days in a row", body: "A month with everything done." },
    100: { title: "One hundred days in a row", body: "A hundred complete days, one after another." },
};

/**
 * What is said when a run of days reaches a milestone.
 * @param {Number} days - one of STREAK_MILESTONES
 * @param {Object} facts
 * @param {Number} [facts.bonus] - the XP today's complete day was paid
 * @param {Boolean} [facts.longest] - no run of this account's has been longer
 * @returns {Object|null} - { title, body, notes }
 */
export const milestoneWords = (days, { bonus = 0, longest = false } = {}) => {
    const words = MILESTONES[days];
    if (!words) return null;

    return {
        ...words,
        notes: [
            longest ? "Your longest run so far." : "",
            bonus > 0 ? `Today’s bonus for a complete day: +${xp(bonus)}.` : "",
        ].filter(Boolean),
    };
};
