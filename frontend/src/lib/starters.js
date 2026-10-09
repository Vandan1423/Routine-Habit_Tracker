// What a new account is offered to begin with: a handful of routines and habits it can take as they are.
// Each one is an ordinary item, made through the same form rules as any other (lib/itemForm.js), and can be
// renamed, moved or deleted afterwards like any other. No React here.

import { buildDay, minutesOf } from "./day";
import { countWord } from "./dayMessage";
import { emptyForm, payloadOf } from "./itemForm";
import { HABIT_XP, ROUTINE_XP, missCost } from "./stakes";
import { toMinutes } from "./time";

const routine = (id, title, startTime, category) => ({
    id,
    kind: "routine",
    form: { title, startTime, category },
});

const habit = (id, title, timeOfDay, difficulty, category, counted) => ({
    id,
    kind: "habit",
    form: {
        title,
        timeOfDay,
        difficulty,
        category,
        ...(counted ? { tracking: "quantity", target: String(counted.target), unit: counted.unit } : null),
    },
});

// In the order a day runs. Routines have no end time, so none of them can be late: done at any hour of
// its day, each pays in full.
export const STARTERS = [
    routine("wake", "Wake up", "07:00", "personal"),
    habit("meditate", "Meditate", "morning", "medium", "health"),
    routine("focus", "Deep work", "14:00", "work"),
    habit("walk", "Walk", "afternoon", "easy", "fitness"),
    routine("plan", "Plan tomorrow", "21:30", "personal"),
    habit("journal", "Journal", "evening", "easy", "personal"),
    routine("lights", "Lights out", "22:30", "health"),
    habit("water", "Drink water", "anytime", "easy", "health", { target: 8, unit: "glasses" }),
    habit("read", "Read", "anytime", "medium", "learning", { target: 20, unit: "pages" }),
    habit("exercise", "Exercise", "anytime", "hard", "fitness"),
];

const formOf = (starter) => ({ ...emptyForm(starter.kind), ...starter.form });

// What is sent to the API to make one
export const starterPayload = (starter) => payloadOf(starter.kind, formOf(starter));

const worthOf = (starter) =>
    starter.kind === "routine" ? ROUTINE_XP : HABIT_XP[starter.form.difficulty];

// A starter as the API would send it back once made, untouched: enough for buildDay to draw it
const asItem = (starter) => {
    const data = starterPayload(starter);

    return { ...data, _id: starter.id, xpReward: worthOf(starter), todayLog: null, dueToday: true };
};

/**
 * The starters as a day: every one of them laid out by part of the day (for the list to choose from),
 * and the chosen ones alone as the day they would make (for the strip drawn above it).
 *
 * @param {Array} chosen - the ids picked so far
 * @param {Date} now
 * @returns {Object} - offered: the day's parts, each item with its `starter`, `chosen`, and `passed`
 *   (a routine whose hour has already gone by today); day: buildDay's answer for the chosen ones;
 *   count, worth: how many are chosen and what they pay together; cost: what leaving them all open costs;
 *   passed: how many of the chosen were due earlier today
 */
export const buildStarters = (chosen, now) => {
    const picked = new Set(chosen);
    const nowMinutes = minutesOf(now);
    const byId = new Map(STARTERS.map((starter) => [starter.id, starter]));

    const dayOf = (starters) =>
        buildDay({
            routines: starters.filter((starter) => starter.kind === "routine").map(asItem),
            habits: starters.filter((starter) => starter.kind === "habit").map(asItem),
            now,
        });

    const offered = dayOf(STARTERS).blocks.map((block) => ({
        ...block,
        items: block.items.map((item) => ({
            ...item,
            starter: byId.get(item.id),
            chosen: picked.has(item.id),
            passed: item.start !== null && toMinutes(item.start) < nowMinutes,
        })),
    }));

    const mine = offered.flatMap((block) => block.items).filter((item) => item.chosen);

    return {
        offered,
        day: dayOf(mine.map((item) => item.starter)),
        count: mine.length,
        worth: mine.reduce((sum, item) => sum + item.worth, 0),
        cost: mine.reduce((sum, item) => sum + missCost(item.kind, item.worth), 0),
        passed: mine.filter((item) => item.passed).length,
    };
};

/**
 * Makes the chosen starters, routines and habits side by side, each kind one after the other so that
 * they are saved in the order of the day.
 * @param {Array} starters - the ones to make
 * @param {Function} create - (kind, data) => Promise, as createItem of usePlan
 * @returns {Promise<Object>} - { made, failed }: how many were saved, and the starters that were not
 */
export const addStarters = async (starters, create) => {
    const failed = [];
    let made = 0;

    const inTurn = async (kind) => {
        for (const starter of starters.filter((entry) => entry.kind === kind)) {
            try {
                await create(kind, starterPayload(starter));
                made += 1;
            } catch {
                failed.push(starter);
            }
        }
    };

    await Promise.all([inTurn("routine"), inTurn("habit")]);
    return { made, failed };
};

// ── The words of the first day ──

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();
const xp = (amount) => `${numberFormat.format(amount)}${NBSP}XP`;
const lower = (count) => countWord(count).toLowerCase();

export const STARTERS_TITLE = "Start with a few";
export const STARTERS_LEAD =
    "Choose what belongs in your days. Each one is worth XP when it is done, and costs some back if the day closes without it. Names and hours can be changed later.";

// Said of a routine whose hour has gone by today
export const PASSED_WORDS = "earlier today";

// The button that makes them
export const startWords = (count) => {
    if (count === 0) return "Choose something to start";
    return count === 1 ? "Start with this one" : `Start with these ${lower(count)}`;
};

/**
 * What choosing these means, stated before anything is made.
 * @param {Object} starters - from buildStarters
 * @returns {Object} - { lead, rest }
 */
export const stakesOfStarters = ({ count, worth, cost, passed }) => {
    if (count === 0) {
        return { lead: "Nothing chosen yet.", rest: "Today begins with whatever you pick." };
    }

    const lead = `${countWord(count)} a day, worth ${xp(worth)} when ${count === 1 ? "it is" : "all are"} done.`;
    const open =
        count === 1
            ? `Left open at midnight, it costs ${xp(cost)}`
            : `Left open at midnight, they cost ${xp(cost)} between them`;
    const early =
        passed === 0
            ? ""
            : passed === 1
              ? " One was due earlier today and can still be done."
              : ` ${countWord(passed)} were due earlier today and can still be done.`;

    return {
        lead,
        rest: `Today counts from now. ${open}, though never more XP than you hold.${early}`,
    };
};

// When some, or all, could not be saved: { message, detail }
export const startersFailedWords = (made, failed) => {
    if (made === 0) return { message: "Nothing was added", detail: "The server couldn’t be reached." };

    return { message: `${countWord(made)} added. ${countWord(failed)} didn’t save.` };
};
