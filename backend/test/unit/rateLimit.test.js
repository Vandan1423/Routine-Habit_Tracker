import "../helpers/env.js";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";

import {
    authRateLimit,
    loginAccountRateLimit,
    passwordResetRateLimit,
} from "../../src/middlewares/rateLimitMiddleware.js";

// A tiny stand-in app: just the limiters, no database
const app = express();
app.use(express.json());
app.post("/flood", authRateLimit, (req, res) => res.json({ ok: true }));
app.post("/login", loginAccountRateLimit, (req, res) =>
    res.status(req.body.password === "right" ? 200 : 400).json({}),
);
app.post("/reset", passwordResetRateLimit, (req, res) => res.json({ ok: true }));

let server;
let url;

const hit = async (path, { headers = {}, body = {} } = {}) => {
    const response = await fetch(url + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
    return {
        status: response.status,
        remaining: Number(response.headers.get("ratelimit-remaining")),
    };
};

describe("rate limits", () => {
    before(async () => {
        server = app.listen(0);
        await once(server, "listening");
        url = `http://127.0.0.1:${server.address().port}`;
    });

    after(() => server.close());

    describe("per address", () => {
        it("gives each visitor address its own budget", async () => {
            const first = await hit("/flood", { headers: { "x-test-client-ip": "203.0.113.10" } });
            const second = await hit("/flood", { headers: { "x-test-client-ip": "203.0.113.10" } });
            const other = await hit("/flood", { headers: { "x-test-client-ip": "198.51.100.7" } });

            assert.equal(first.remaining, 29);
            assert.equal(second.remaining, 28);
            assert.equal(other.remaining, 29);
        });

        it("ignores a made-up X-Forwarded-For", async () => {
            const spoofed = await hit("/flood", {
                headers: { "x-test-client-ip": "203.0.113.10", "x-forwarded-for": "9.9.9.9" },
            });
            assert.equal(spoofed.remaining, 27);
        });

        it("treats one IPv6 network as one visitor", async () => {
            const a = await hit("/flood", { headers: { "x-test-client-ip": "2001:db8:1:1::1" } });
            const b = await hit("/flood", { headers: { "x-test-client-ip": "2001:db8:1:1:ffff::2" } });
            assert.equal(a.remaining, 29);
            assert.equal(b.remaining, 28);
        });

        it("blocks the 31st request in 15 minutes", async () => {
            const statuses = [];
            for (let i = 0; i < 31; i++) {
                statuses.push((await hit("/flood", { headers: { "x-test-client-ip": "192.0.2.99" } })).status);
            }
            assert.ok(statuses.slice(0, 30).every((status) => status === 200));
            assert.equal(statuses[30], 429);
        });

        it("does not read the address header unless it is configured", async () => {
            const configured = process.env.CLIENT_IP_HEADER;
            delete process.env.CLIENT_IP_HEADER;
            try {
                const a = await hit("/flood", { headers: { "x-test-client-ip": "1.2.3.4" } });
                const b = await hit("/flood", { headers: { "x-test-client-ip": "5.6.7.8" } });
                assert.equal(b.remaining, a.remaining - 1);
            } finally {
                process.env.CLIENT_IP_HEADER = configured;
            }
        });
    });

    describe("per account", () => {
        it("allows 5 failed logins per account, then blocks", async () => {
            const statuses = [];
            for (let i = 0; i < 6; i++) {
                statuses.push((await hit("/login", { body: { email: "victim@example.com", password: "wrong" } })).status);
            }
            assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
        });

        it("leaves other accounts alone, even from the same address", async () => {
            const other = await hit("/login", { body: { email: "someone-else@example.com", password: "wrong" } });
            assert.equal(other.status, 400);
        });

        it("never counts a successful login", async () => {
            const statuses = [];
            for (let i = 0; i < 8; i++) {
                statuses.push((await hit("/login", { body: { email: "regular@example.com", password: "right" } })).status);
            }
            assert.ok(statuses.every((status) => status === 200));
        });

        it("allows 3 reset emails per account per hour", async () => {
            const statuses = [];
            for (let i = 0; i < 4; i++) {
                statuses.push((await hit("/reset", { body: { email: "forgetful@example.com" } })).status);
            }
            assert.deepEqual(statuses, [200, 200, 200, 429]);
        });
    });
});
