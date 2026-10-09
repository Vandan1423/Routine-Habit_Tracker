import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    addDays,
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import Routine from "../../src/models/Routine.js";
import RoutineLog from "../../src/models/RoutineLog.js";
import Habit from "../../src/models/Habit.js";
import HabitLog from "../../src/models/HabitLog.js";
import DailyLog from "../../src/models/DailyLog.js";
import XPLog from "../../src/models/XPLog.js";

// What the Insights and History screens are told about days that have ended: each day's summary, one day item
// by item, how each routine and habit has gone over a stretch of days, and the XP ledger. All of it read-only.

const TZ = "Asia/Kolkata";
const DAY = 24 * 60 * 60 * 1000;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("looking back over ended days", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const daysAgo = (days) => addDays(today, -days);
    const longAgo = new Date(Date.now() - 10 * DAY);

    before(startApp);
    after(stopApp);

    // A signed-in account, and the same account as the database holds it
    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });

        return {
            client,
            user,
            routine: (fields = {}) =>
                Routine.create({ user: user._id, title: "Routine", startTime: "08:00", endTime: "09:00", isRecurring: true, recurringDays: EVERY_DAY, xpReward: 10, createdAt: longAgo, ...fields }),
            habit: (fields = {}) =>
                Habit.create({ user: user._id, title: "Habit", difficulty: "medium", createdAt: longAgo, ...fields }),
            done: (routine, date, fields = {}) =>
                RoutineLog.create({ routine: routine._id, user: user._id, date, completedAt: "08:10", wasOnTime: true, xpEarned: routine.xpReward, ...fields }),
            logged: (habit, date, fields = {}) =>
                HabitLog.create({ habit: habit._id, user: user._id, date, completed: true, quantity: 1, xpEarned: habit.xpReward, ...fields }),
            // Puts the account this many days behind, so its next request closes them
            fallBehind: (days, xp = 500) =>
                User.updateOne({ _id: user._id }, { xp, penaltiesSettledThrough: daysAgo(days + 1) }),
            get: async (path) => (await client.get(path)).body,
        };
    };

    const range = (from, to) => `from=${from}&to=${to}`;
    const byTitle = (items) => Object.fromEntries(items.map((item) => [item.title, item]));

    describe("the summaries of a stretch of days", () => {
        it("lists each day with what was due, what got done, what it netted and what it lost", async () => {
            const { routine, habit, done, fallBehind, get } = await setup();

            const run = await routine();
            await habit();
            // The routine was done the day before yesterday; nothing was done yesterday
            await done(run, daysAgo(2));
            await fallBehind(2);

            const answer = await get(`/history/days?${range(daysAgo(6), daysAgo(1))}`);
            assert.equal(answer.today, today);
            assert.equal(answer.since, daysAgo(2));
            assert.deepEqual(answer.days.map((day) => day.date), [daysAgo(2), daysAgo(1)]);

            const [dayBefore, yesterday] = answer.days;
            // The routine was done and the habit was not: no bonus, and the habit's charge
            assert.deepEqual(dayBefore, {
                date: daysAgo(2),
                totalRoutines: 1,
                completedRoutines: 1,
                totalHabits: 1,
                completedHabits: 0,
                isPerfectDay: false,
                isRestDay: false,
                xpNet: -5,
                xpLost: 5,
            });
            assert.equal(yesterday.isPerfectDay, false);
            assert.equal(yesterday.xpLost, 10);
            assert.equal(yesterday.xpNet, -10);
        });

        it("leaves out the days outside the dates asked for", async () => {
            const { routine, fallBehind, get } = await setup();

            await routine();
            await fallBehind(3);

            const { days, since } = await get(`/history/days?${range(daysAgo(2), daysAgo(2))}`);
            assert.deepEqual(days.map((day) => day.date), [daysAgo(2)]);
            // The first day there is anything for, wherever the dates asked for start
            assert.equal(since, daysAgo(3));
        });

        it("answers an account with no day behind it with nothing", async () => {
            const { get } = await setup();

            assert.deepEqual(await get(`/history/days?${range(daysAgo(30), today)}`), { today, since: null, days: [] });
        });

        it("refuses dates that are missing, impossible, backwards or more than a year apart", async () => {
            const { client } = await setup();

            for (const query of [
                "",
                `from=${daysAgo(3)}`,
                `from=2026-02-30&to=${today}`,
                range(today, daysAgo(1)),
                range(daysAgo(366), today),
                "from[$gt]=&to[$gt]=",
            ]) {
                assert.equal((await client.get(`/history/days?${query}`)).status, 400, query);
                assert.equal((await client.get(`/history/items?${query}`)).status, 400, query);
            }

            assert.equal((await client.get(`/history/days?${range(daysAgo(365), today)}`)).status, 200);
        });
    });

    describe("one ended day", () => {
        it("says what was done, done late, part done and missed, and what each paid or cost", async () => {
            const { user, routine, habit, done, logged, fallBehind, get } = await setup();

            const run = await routine({ title: "Morning run", startTime: "06:30", endTime: "07:00" });
            const deep = await routine({ title: "Deep work", startTime: "09:00", endTime: "11:00" });
            const read = await routine({ title: "Read", startTime: "21:00", endTime: "", xpReward: 20 });
            const journal = await habit({ title: "Journal", timeOfDay: "evening" });
            const water = await habit({ title: "Water", habitType: "quantity", targetQuantity: 8, unit: "glasses" });
            const meditate = await habit({ title: "Meditate", timeOfDay: "morning" });

            const yesterday = daysAgo(1);
            await done(run, yesterday, { completedAt: "06:50" });
            await done(deep, yesterday, { completedAt: "11:40", wasOnTime: false, xpEarned: 5 });
            await logged(journal, yesterday);
            await logged(water, yesterday, { completed: false, quantity: 3, xpEarned: undefined });
            await fallBehind(1);

            const day = await get(`/history/days/${yesterday}`);
            assert.equal(day.date, yesterday);
            assert.equal(day.today, today);
            assert.equal(day.since, yesterday);

            const items = byTitle(day.items);
            assert.equal(day.items.length, 6);

            assert.deepEqual(items["Morning run"], { kind: "routine", id: run._id.toString(), title: "Morning run", active: true, startTime: "06:30", endTime: "07:00", status: "done", completedAt: "06:50", xpEarned: 10 });
            assert.equal(items["Deep work"].status, "late");
            assert.equal(items["Deep work"].xpEarned, 5);
            assert.deepEqual(items.Read, { kind: "routine", id: read._id.toString(), title: "Read", active: true, startTime: "21:00", endTime: "", status: "missed", xpLost: 10 });

            assert.deepEqual(items.Journal, { kind: "habit", id: journal._id.toString(), title: "Journal", active: true, timeOfDay: "evening", counted: false, target: 1, unit: "", status: "done", quantity: 1, xpEarned: 15 });
            // Short of its target: what was counted is kept, and so is what falling short cost
            assert.deepEqual(items.Water, { kind: "habit", id: water._id.toString(), title: "Water", active: true, timeOfDay: "anytime", counted: true, target: 8, unit: "glasses", status: "partial", quantity: 3, xpLost: 5 });
            assert.deepEqual(items.Meditate, { kind: "habit", id: meditate._id.toString(), title: "Meditate", active: true, timeOfDay: "morning", counted: false, target: 1, unit: "", quantity: 0, status: "missed", xpLost: 5 });

            assert.deepEqual(day.summary, { date: yesterday, totalRoutines: 3, completedRoutines: 2, totalHabits: 3, completedHabits: 1, isPerfectDay: false, isRestDay: false, xpNet: -20, xpLost: 20 });
            assert.equal(day.xpLost, 20);
            assert.equal(day.unnamed, 0);
            assert.equal(day.bonus, 0);
            assert.equal(day.run, 0);

            // What the day says it lost is what the account lost
            assert.equal((await User.findById(user._id)).xp, 500 - 20);
        });

        it("gives the bonus and the run for a day with everything done", async () => {
            const { user, routine, done, fallBehind, get } = await setup();

            const run = await routine();
            await DailyLog.create(
                [4, 3, 2].map((days) => ({ user: user._id, date: daysAgo(days), totalRoutines: 1, completedRoutines: 1, isPerfectDay: true })),
            );
            await done(run, daysAgo(1));
            await fallBehind(1);

            const day = await get(`/history/days/${daysAgo(1)}`);
            assert.equal(day.summary.isPerfectDay, true);
            assert.equal(day.bonus, 20);
            assert.equal(day.run, 4);
            assert.equal(day.streakEnded, 0);
            assert.equal(day.xpLost, 0);
        });

        it("says how long a run was on the day that ended it", async () => {
            const { user, routine, fallBehind, get } = await setup();

            await routine();
            await DailyLog.create(
                [4, 3, 2].map((days) => ({ user: user._id, date: daysAgo(days), totalRoutines: 1, completedRoutines: 1, isPerfectDay: true })),
            );
            await fallBehind(1);

            const day = await get(`/history/days/${daysAgo(1)}`);
            assert.equal(day.run, 0);
            assert.equal(day.streakEnded, 3);
        });

        it("counts what was left undone but cost nothing, without being able to name it", async () => {
            const { routine, habit, fallBehind, get } = await setup();

            await routine();
            await habit();
            // No XP to take: the ledger gets no entry
            await fallBehind(1, 0);

            const day = await get(`/history/days/${daysAgo(1)}`);
            assert.deepEqual(day.items, []);
            assert.equal(day.unnamed, 2);
            assert.equal(day.xpLost, 0);
        });

        it("still names an item that has been deleted since, and marks it as gone", async () => {
            const { routine, done, fallBehind, get } = await setup();

            const gone = await routine({ title: "Stretch" });
            await done(gone, daysAgo(1));
            await fallBehind(1);
            await get(`/history/days/${daysAgo(1)}`);
            await Routine.updateOne({ _id: gone._id }, { isActive: false });

            const [item] = (await get(`/history/days/${daysAgo(1)}`)).items;
            assert.equal(item.title, "Stretch");
            assert.equal(item.active, false);
        });

        it("has nothing for a day nothing happened on", async () => {
            const { get } = await setup();

            const day = await get(`/history/days/${daysAgo(40)}`);
            assert.equal(day.summary, null);
            assert.deepEqual(day.items, []);
            assert.equal(day.unnamed, 0);
            assert.equal(day.since, null);
        });

        it("refuses today, a day still to come, and anything that is not a day", async () => {
            const { client } = await setup();

            for (const date of [today, addDays(today, 1), "2026-13-01", "yesterday"]) {
                assert.equal((await client.get(`/history/days/${date}`)).status, 400, date);
            }
        });
    });

    describe("each item over a stretch of days", () => {
        it("counts how often it was done, done late and missed, and what that paid and cost", async () => {
            const { routine, habit, done, logged, fallBehind, get } = await setup();

            const run = await routine({ title: "Morning run" });
            const journal = await habit({ title: "Journal" });
            await done(run, daysAgo(3));
            await done(run, daysAgo(2), { wasOnTime: false, xpEarned: 5 });
            await logged(journal, daysAgo(3));
            await fallBehind(3);

            const answer = await get(`/history/items?${range(daysAgo(7), daysAgo(1))}`);
            assert.equal(answer.from, daysAgo(7));
            assert.equal(answer.to, daysAgo(1));

            const items = byTitle(answer.items);
            assert.deepEqual(items["Morning run"], { kind: "routine", id: run._id.toString(), title: "Morning run", active: true, done: 2, late: 1, missed: 1, xpEarned: 15, xpLost: 5 });
            assert.deepEqual(items.Journal, { kind: "habit", id: journal._id.toString(), title: "Journal", active: true, done: 1, late: 0, missed: 2, xpEarned: 15, xpLost: 10 });

            // Only the days asked for
            const lastDay = byTitle((await get(`/history/items?${range(daysAgo(1), daysAgo(1))}`)).items);
            assert.equal(lastDay["Morning run"].done, 0);
            assert.equal(lastDay["Morning run"].missed, 1);
        });
    });

    describe("the XP ledger", () => {
        it("lists every gain and loss, newest first, with the item and the day each belongs to", async () => {
            const { client, routine, habit, done, fallBehind, get } = await setup();

            const run = await routine({ title: "Morning run" });
            const journal = await habit({ title: "Journal" });
            await done(run, daysAgo(2));
            await fallBehind(2);

            const { entries, next } = await get("/history/ledger");
            assert.equal(next, null);

            const said = entries.map((entry) => `${entry.date} ${entry.reason} ${entry.title} ${entry.amount}`).sort();
            assert.deepEqual(said, [
                `${daysAgo(1)} habit_missed Journal -5`,
                `${daysAgo(1)} routine_missed Morning run -5`,
                `${daysAgo(2)} habit_missed Journal -5`,
            ].sort());

            const times = entries.map((entry) => Date.parse(entry.at));
            assert.deepEqual(times, [...times].sort((a, b) => b - a));

            const missedRun = entries.find((entry) => entry.reason === "routine_missed");
            assert.equal(missedRun.kind, "routine");
            assert.equal(missedRun.itemId, run._id.toString());
            assert.equal(missedRun.active, true);
            assert.equal(entries.find((entry) => entry.reason === "habit_missed").itemId, journal._id.toString());

            // Something done today is dated today, and says whether it was late
            const tick = await client.post(`/routines/${run._id}/complete`, {});
            assert.equal(tick.status, 200);
            // With the habit done as well, everything due is done: the day's bonus is the newest entry, and is about no item
            assert.equal((await client.put(`/habits/${journal._id}/log`, { quantity: 1 })).status, 200);
            const [newest] = (await get("/history/ledger")).entries;
            assert.equal(newest.reason, "perfect_day_bonus");
            assert.equal(newest.kind, null);
            const completion = (await get("/history/ledger")).entries.find((entry) => entry.reason === "routine_complete");
            assert.equal(completion.date, today);
            assert.equal(completion.title, "Morning run");
            assert.equal(typeof completion.late, "boolean");
        });

        it("is read a page at a time, without repeating or skipping an entry", async () => {
            const { user, get } = await setup();

            // Seven entries, three of them written in the same instant
            const at = (minutes) => new Date(Date.now() - minutes * 60 * 1000);
            const same = at(30);
            await XPLog.create(
                [at(50), at(40), same, same, same, at(20), at(10)].map((createdAt, index) => ({ user: user._id, amount: index + 1, reason: "routine_complete", createdAt })),
            );

            const seen = [];
            let before = "";
            for (let page = 0; page < 5; page += 1) {
                const answer = await get(`/history/ledger?limit=2${before ? `&before=${before}` : ""}`);
                seen.push(...answer.entries.map((entry) => entry.id));
                if (!answer.next) break;
                assert.equal(answer.entries.length, 2);
                before = answer.next;
            }

            assert.equal(seen.length, 7);
            assert.equal(new Set(seen).size, 7);
        });

        it("refuses a page size or a place that makes no sense", async () => {
            const { client } = await setup();

            for (const query of ["limit=0", "limit=101", "limit=many", "before=yesterday", "before=1760000000000"]) {
                assert.equal((await client.get(`/history/ledger?${query}`)).status, 400, query);
            }
        });
    });

    it("shows one account nothing of another's days", async () => {
        const alice = await setup();
        const bob = await setup();

        const run = await alice.routine({ title: "Alice only" });
        await alice.done(run, daysAgo(1));
        await alice.fallBehind(1);
        assert.equal((await alice.get(`/history/days/${daysAgo(1)}`)).items.length, 1);

        assert.deepEqual((await bob.get(`/history/days?${range(daysAgo(7), today)}`)).days, []);
        assert.deepEqual((await bob.get(`/history/days/${daysAgo(1)}`)).items, []);
        assert.deepEqual((await bob.get(`/history/items?${range(daysAgo(7), today)}`)).items, []);
        assert.deepEqual((await bob.get("/history/ledger")).entries, []);

        // And none of it can be read signed out
        const stranger = createClient({ timezone: TZ });
        for (const path of [`/history/days?${range(daysAgo(7), today)}`, `/history/days/${daysAgo(1)}`, `/history/items?${range(daysAgo(7), today)}`, "/history/ledger"]) {
            assert.equal((await stranger.get(path)).status, 401, path);
        }
    });
});
