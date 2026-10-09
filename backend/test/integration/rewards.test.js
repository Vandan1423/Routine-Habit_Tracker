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
import XPLog from "../../src/models/XPLog.js";
import { applyPenalty } from "../../src/utils/penaltyEngine.js";
import { awardXP, revokeXP } from "../../src/utils/rewardEngine.js";

// A timezone where it is currently the middle of the day, so "long before" and "long after" both exist today
const middayZone = () =>
    ["UTC", "Asia/Kolkata", "Asia/Tokyo", "America/New_York", "America/Los_Angeles", "Pacific/Auckland", "Europe/London"].find((zone) => {
        const hour = Number(new Date().toLocaleTimeString("en-GB", { timeZone: zone, hourCycle: "h23", hour: "2-digit" }));
        return hour >= 4 && hour <= 20;
    });

const minutesNowIn = (zone) => {
    const [hour, minute] = new Date()
        .toLocaleTimeString("en-GB", { timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" })
        .split(":")
        .map(Number);
    return hour * 60 + minute;
};

describe("reward rules", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const setup = async (timezone = middayZone()) => {
        const client = createClient({ timezone });
        await client.register();
        const today = todayIn(timezone);

        return {
            client,
            today,
            timezone,
            stats: async () => (await client.get("/gamification/stats")).body,
            routine: async (fields = {}) =>
                (await client.post("/routines", { title: "Routine", startTime: "00:00", endTime: "23:59", isRecurring: false, recurringDays: [], date: today, ...fields })).body,
            complete: (routine, body = {}) => client.post(`/routines/${routine._id}/complete`, { date: today, ...body }),
            undo: (routine) => client.delete(`/routines/${routine._id}/complete`, { date: today }),
        };
    };

    describe("when a completion is accepted", () => {
        it("only for the user's current day", async () => {
            const { client, today, routine } = await setup();
            const item = await routine({ isRecurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6] });

            for (const date of [addDays(today, -1), addDays(today, 1), "2019-03-01"]) {
                const response = await client.post(`/routines/${item._id}/complete`, { date });
                assert.equal(response.status, 400, date);
                assert.match(response.body.message, /current day/);
            }
        });

        it("only on a day the routine is scheduled for", async () => {
            const { complete, routine } = await setup();
            const otherWeekday = (new Date().getUTCDay() + 3) % 7;
            const item = await routine({ isRecurring: true, recurringDays: [otherWeekday], date: null });

            const response = await complete(item);
            // Whatever weekday it is for this user right now, it is at most one away from the UTC weekday
            assert.equal(response.status, 400);
            assert.match(response.body.message, /not scheduled/);
        });

        it("never for a deleted routine or habit", async () => {
            const { client, complete, routine } = await setup();

            const item = await routine();
            await client.delete(`/routines/${item._id}`);
            assert.equal((await complete(item)).status, 404);

            const habit = (await client.post("/habits", { title: "Gone", difficulty: "easy" })).body.habit;
            await client.delete(`/habits/${habit._id}`);
            assert.equal((await client.post(`/habits/${habit._id}/log`, { quantity: 1 })).status, 404);
        });

        it("only once per day", async () => {
            const { complete, routine } = await setup();
            const item = await routine();
            assert.equal((await complete(item)).status, 200);
            assert.equal((await complete(item)).status, 400);
        });

        it("for habits too: today only", async () => {
            const { client, today } = await setup();
            const habit = (await client.post("/habits", { title: "Read", difficulty: "easy" })).body.habit;

            assert.equal((await client.post(`/habits/${habit._id}/log`, { date: addDays(today, -1) })).status, 400);
            assert.equal((await client.post(`/habits/${habit._id}/log`, { quantity: 1 })).status, 200);
        });
    });

    describe("completion time", () => {
        it("comes from the server's clock in the user's timezone, not from the client", async () => {
            const { complete, routine, timezone } = await setup();
            const item = await routine({ endTime: "" });

            const response = await complete(item, { completedAt: "00:01" });
            const [hour, minute] = response.body.log.completedAt.split(":").map(Number);
            assert.ok(Math.abs(hour * 60 + minute - minutesNowIn(timezone)) <= 2, response.body.log.completedAt);
        });

        it("is never late when the routine has no end time", async () => {
            const { complete, routine } = await setup();
            const response = await complete(await routine({ endTime: "" }));
            assert.equal(response.body.log.wasOnTime, true);
            assert.equal(response.body.log.xpEarned, 10);
        });

        it("is late, for half XP, once the deadline has passed, whatever the client claims", async () => {
            const { complete, routine } = await setup();
            const response = await complete(await routine({ endTime: "00:01" }), { completedAt: "00:01" });
            assert.equal(response.body.log.wasOnTime, false);
            assert.equal(response.body.log.xpEarned, 5);
        });
    });

    describe("undoing a completion", () => {
        it("takes the XP back, and ticking again gains nothing extra", async () => {
            const { complete, undo, routine, stats } = await setup();
            await routine({ title: "Keeps the day from being perfect" });
            const item = await routine();

            await complete(item);
            const done = (await stats()).totalXp;
            assert.equal(done, 10);

            await undo(item);
            assert.equal((await stats()).totalXp, 0);

            for (let i = 0; i < 3; i++) {
                await complete(item);
                assert.equal((await stats()).totalXp, done);
                await undo(item);
                assert.equal((await stats()).totalXp, 0);
            }
        });

        it("returns level-up coins and the perfect-day bonus, and does not pay them twice", async () => {
            const { client, complete, undo, routine, stats } = await setup();

            // 75 XP from three hard habits, then the one routine still open: 10 XP + 20 perfect-day bonus crosses level 2
            const item = await routine();
            for (let i = 0; i < 3; i++) {
                const habit = (await client.post("/habits", { title: `Hard ${i}`, difficulty: "hard" })).body.habit;
                await client.post(`/habits/${habit._id}/log`, { quantity: 1 });
            }
            const before = await stats();
            assert.deepEqual([before.level, before.totalXp, before.coins], [1, 75, 0]);

            await complete(item);
            const after = await stats();
            assert.deepEqual([after.level, after.totalXp, after.coins], [2, 105, 100]);

            await undo(item);
            const undone = await stats();
            assert.deepEqual([undone.level, undone.totalXp, undone.coins], [1, 75, 0]);

            await complete(item);
            const again = await stats();
            assert.deepEqual([again.level, again.totalXp, again.coins], [2, 105, 100]);
        });
    });

    describe("several changes at the same instant", () => {
        const together = (count, change) => Promise.all(Array.from({ length: count }, change));
        const balanceOf = async (id) => {
            const { xp, coins } = await User.findById(id);
            return { xp, coins };
        };

        it("pays every one of several routines ticked together", async () => {
            const { complete, routine, stats } = await setup();
            await routine({ title: "Keeps the day from being perfect" });
            const items = [];
            for (let i = 0; i < 6; i++) {
                items.push(await routine({ title: `Routine ${i}` }));
            }

            const responses = await Promise.all(items.map((item) => complete(item)));

            assert.ok(responses.every((response) => response.status === 200));
            assert.equal((await stats()).totalXp, 60);
        });

        it("loses no award, and pays the coins of a level reached once", async () => {
            const client = createClient();
            const { user } = await client.register();

            // 6 x 20 XP: level 2 starts at 100, and reaching it pays 100 coins
            const awards = await together(6, () => awardXP(user._id, 20, "test_award"));

            assert.deepEqual(await balanceOf(user._id), { xp: 120, coins: 100 });
            assert.equal(awards.filter((award) => award.leveledUp).length, 1);
            assert.equal(awards.reduce((sum, award) => sum + award.coinsAwarded, 0), 100);
            assert.equal(await XPLog.countDocuments({ user: user._id, reason: "test_award" }), 6);

            // And back again: what is taken adds up to what there was
            const reversals = await together(6, () => revokeXP(user._id, 20, "test_reversal"));

            assert.deepEqual(await balanceOf(user._id), { xp: 0, coins: 0 });
            assert.equal(reversals.reduce((sum, reversal) => sum + reversal.xpRevoked, 0), 120);
            assert.equal(reversals.reduce((sum, reversal) => sum + reversal.coinsRevoked, 0), 100);
        });

        it("never charges more than the account holds", async () => {
            const client = createClient();
            const { user } = await client.register();
            await awardXP(user._id, 50, "test_award");

            const penalties = await together(6, () => applyPenalty(user._id, 20, "test_penalty"));

            assert.equal((await balanceOf(user._id)).xp, 0);
            assert.equal(penalties.reduce((sum, penalty) => sum + penalty.xpLost, 0), 50);
        });
    });

    describe("the day's summary", () => {
        it("counts all XP earned that day and how many habits were due and done", async () => {
            const { client, today, complete, undo, routine, stats } = await setup();
            const todaysLog = async () =>
                (await client.get("/streaks/logs?days=3")).body.logs.find((log) => log.date === today);

            const item = await routine();
            await complete(item);
            assert.equal((await todaysLog()).xpEarned, (await stats()).totalXp);

            const habit = (await client.post("/habits", { title: "First", difficulty: "easy" })).body.habit;
            await client.post("/habits", { title: "Second", difficulty: "easy" });
            await client.post(`/habits/${habit._id}/log`, { quantity: 1 });

            let log = await todaysLog();
            assert.equal(log.xpEarned, (await stats()).totalXp);
            assert.equal(log.totalHabits, 2);
            assert.equal(log.completedHabits, 1);

            await undo(item);
            log = await todaysLog();
            assert.equal(log.xpEarned, (await stats()).totalXp);
        });
    });
});
