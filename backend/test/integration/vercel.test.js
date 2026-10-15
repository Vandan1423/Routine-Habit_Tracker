import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import rateLimit from "express-rate-limit";

import { createClient, skipWithoutDatabase, startApp, stopApp } from "../helpers/app.js";
import RateLimitHit from "../../src/models/RateLimitHit.js";
import { DatabaseStore } from "../../src/utils/rateLimitStore.js";

// What running on Vercel needs beyond a plain server: rate limit counts kept in the database (every copy of the
// function counts against one budget), and the background jobs started by a scheduler through /api/jobs.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("running on Vercel", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    describe("rate limit counts in the database", () => {
        const fresh = (windowMs = 60_000) => {
            const store = new DatabaseStore(`test-${Date.now()}-${Math.random()}`);
            store.init({ windowMs });
            return store;
        };

        it("counts, takes back and forgets hits for one key", async () => {
            const store = fresh();

            assert.equal(await store.get("a"), undefined);
            assert.equal((await store.increment("a")).totalHits, 1);
            const second = await store.increment("a");
            assert.equal(second.totalHits, 2);
            assert.ok(second.resetTime > new Date());

            await store.decrement("a");
            assert.equal((await store.get("a")).totalHits, 1);

            await store.resetKey("a");
            assert.equal(await store.get("a"), undefined);
        });

        it("keeps keys and limits apart", async () => {
            const one = fresh();
            const other = fresh();

            await one.increment("a");
            await one.increment("a");
            await one.increment("b");
            await other.increment("a");

            assert.equal((await one.get("a")).totalHits, 2);
            assert.equal((await one.get("b")).totalHits, 1);
            assert.equal((await other.get("a")).totalHits, 1);
        });

        it("starts again once the window has ended", async () => {
            const store = fresh(50);

            await store.increment("a");
            await store.increment("a");
            await wait(80);

            assert.equal(await store.get("a"), undefined);
            assert.equal((await store.increment("a")).totalHits, 1);
        });

        it("counts every hit when many arrive at once", async () => {
            const store = fresh();

            const results = await Promise.all(Array.from({ length: 20 }, () => store.increment("a")));

            assert.deepEqual(
                results.map((result) => result.totalHits).sort((x, y) => x - y),
                Array.from({ length: 20 }, (_, index) => index + 1),
            );
        });

        it("refuses once the limit is reached, as the in-memory count does", async () => {
            const app = express();
            app.post(
                "/",
                rateLimit({
                    windowMs: 60_000,
                    max: 2,
                    store: new DatabaseStore(`test-limit-${Date.now()}`),
                    standardHeaders: true,
                    legacyHeaders: false,
                }),
                (req, res) => res.json({ ok: true }),
            );
            const server = app.listen(0);
            await once(server, "listening");
            const url = `http://127.0.0.1:${server.address().port}/`;

            try {
                const statuses = [];
                for (let i = 0; i < 3; i += 1) {
                    statuses.push((await fetch(url, { method: "POST" })).status);
                }
                assert.deepEqual(statuses, [200, 200, 429]);
            } finally {
                server.close();
            }
        });

        it("sets each row to be deleted when its window ends", async () => {
            const indexes = await RateLimitHit.collection.indexes();
            const expiry = indexes.find((index) => index.key.resetAt === 1);
            assert.equal(expiry?.expireAfterSeconds, 0);
        });
    });

    describe("jobs started by a scheduler", () => {
        const client = createClient();
        const SECRET = "test-cron-secret";
        const asScheduler = (secret) => ({ headers: { Authorization: `Bearer ${secret}` } });

        after(() => {
            delete process.env.CRON_SECRET;
        });

        it("are not there at all until CRON_SECRET is set", async () => {
            delete process.env.CRON_SECRET;
            const response = await client.get("/jobs/daily", asScheduler(""));
            assert.equal(response.status, 404);
        });

        it("refuse a caller without the secret", async () => {
            process.env.CRON_SECRET = SECRET;

            assert.equal((await client.get("/jobs/daily")).status, 401);
            assert.equal((await client.get("/jobs/daily", asScheduler("wrong"))).status, 401);
            assert.equal((await client.get("/jobs/reminders", asScheduler(`${SECRET}x`))).status, 401);
        });

        it("run for the scheduler", async () => {
            process.env.CRON_SECRET = SECRET;

            const daily = await client.get("/jobs/daily", asScheduler(SECRET));
            assert.equal(daily.status, 200);
            assert.equal(daily.body.success, true);
            assert.equal(typeof daily.body.purged, "number");

            // No push keys in tests: nothing goes out
            const reminders = await client.get("/jobs/reminders", asScheduler(SECRET));
            assert.equal(reminders.status, 200);
            assert.equal(reminders.body.sent, 0);
        });
    });
});
