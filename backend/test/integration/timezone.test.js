import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";

// UTC+14 and UTC-11: at every moment these two are on different calendar days
const EAST = "Pacific/Kiritimati";
const WEST = "Pacific/Pago_Pago";

describe("timezones", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const timezoneOf = async (client) => (await client.get("/auth/me")).body.user.timezone;

    for (const [zone, otherZone] of [[EAST, WEST], [WEST, EAST]]) {
        describe(`an account in ${zone}`, () => {
            let client;
            let today;
            let otherToday;

            before(async () => {
                client = createClient({ timezone: zone });
                await client.register();
                today = todayIn(zone);
                otherToday = todayIn(otherZone);
            });

            const routine = async (date) =>
                (await client.post("/routines", { title: "Routine", startTime: "00:00", endTime: "23:59", isRecurring: false, recurringDays: [], date })).body;

            it("is created in the timezone its device reported", async () => {
                assert.equal(await timezoneOf(client), zone);
                assert.notEqual(today, otherToday);
            });

            it("gets its own today for routines", async () => {
                const mine = await routine(today);
                const theirs = await routine(otherToday);

                const listed = (await client.get("/routines")).body.routines;
                assert.deepEqual(listed.map((item) => item._id), [mine._id]);

                const done = await client.post(`/routines/${mine._id}/complete`);
                assert.equal(done.status, 200);
                assert.equal(done.body.log.date, today);

                assert.equal((await client.post(`/routines/${theirs._id}/complete`, { date: otherToday })).status, 400);
                assert.equal((await client.delete(`/routines/${theirs._id}/complete`, { date: otherToday })).status, 400);
            });

            it("gets its own today for habits and streaks", async () => {
                const habit = (await client.post("/habits", { title: "Habit", difficulty: "easy" })).body.habit;
                const log = await client.post(`/habits/${habit._id}/log`, { quantity: 1 });

                assert.equal(log.body.log.date, today);
                assert.equal(log.body.habit.currentStreak, 1);

                const listed = (await client.get("/habits")).body.habits.find((item) => item._id === habit._id);
                assert.equal(listed.todayLog.date, today);
            });

            it("gets its own today and month for expenses", async () => {
                const summary = (await client.get("/expenses/summary")).body;
                assert.equal(summary.currentMonthKey, today.slice(0, 7));

                const created = await client.post("/expenses/transactions", { type: "expense", amount: 10, accountId: summary.accounts[0]._id });
                assert.equal(created.body.transaction.transactionDate.slice(0, 10), today);
                assert.equal(created.body.transaction.monthKey, today.slice(0, 7));
            });
        });
    }

    describe("changing timezone", () => {
        it("ignores made-up zones and requests that don't report one", async () => {
            const client = createClient({ timezone: EAST });
            await client.register();

            client.timezone = "Mars/Olympus";
            assert.equal(await timezoneOf(client), EAST);
            client.timezone = null;
            assert.equal(await timezoneOf(client), EAST);
        });

        it("can't be used to reopen a day that has ended", async () => {
            const client = createClient({ timezone: EAST });
            await client.register();

            // Hopping a day west right after signing up is held back by the cooldown
            client.timezone = WEST;
            assert.equal(await timezoneOf(client), EAST);
        });

        it("starts on UTC, adopts the device's zone once, then waits out the cooldown", async () => {
            const client = createClient({ timezone: null });
            await client.register();
            assert.equal(await timezoneOf(client), "UTC");

            client.timezone = "Etc/UTC"; // another name for the zone it is already on
            assert.equal(await timezoneOf(client), "UTC");

            client.timezone = "Asia/Kolkata";
            assert.equal(await timezoneOf(client), "Asia/Kolkata");

            client.timezone = "Asia/Calcutta"; // what Chrome calls the same zone
            assert.equal(await timezoneOf(client), "Asia/Kolkata");

            client.timezone = "Europe/London";
            assert.equal(await timezoneOf(client), "Asia/Kolkata");
        });
    });
});
