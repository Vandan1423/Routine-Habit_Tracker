import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createClient, startApp, stopApp } from "../helpers/app.js";

// Everything here is answered before the database is ever touched, so these run without one

describe("app without a database", () => {
    before(startApp);
    after(stopApp);

    it("answers unknown routes with a clean 404", async () => {
        const response = await createClient().get("/does-not-exist");
        assert.equal(response.status, 404);
        assert.deepEqual(response.body, { success: false, message: "Page Not Found" });
    });

    it("answers invalid JSON with a clean 400", async () => {
        const response = await createClient().post("/auth/login", "{ not json");
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, {
            success: false,
            message: "The request body is not valid JSON.",
        });
    });

    it("refuses protected routes without a token", async () => {
        const client = createClient();
        for (const path of ["/habits", "/routines", "/gamification/stats", "/streaks/info", "/expenses/summary", "/auth/me"]) {
            assert.equal((await client.get(path)).status, 401, path);
        }
    });

    it("refuses a refresh with no cookie", async () => {
        const response = await createClient().post("/auth/refresh-token");
        assert.equal(response.status, 401);
        assert.equal(response.body.message, "No refresh token provided.");
    });

    it("validates sign-up and login input", async () => {
        const client = createClient();

        const shortPassword = await client.post("/auth/register", { name: "A B", email: "a@example.com", password: "123" });
        assert.equal(shortPassword.status, 400);
        assert.match(shortPassword.body.message, /at least 6 characters/);

        const badEmail = await client.post("/auth/login", { email: "not-an-email", password: "whatever" });
        assert.equal(badEmail.status, 400);
    });

    it("refuses a query operator where an email belongs", async () => {
        const response = await createClient().post("/auth/forgot-password", { email: { $ne: null } });
        assert.equal(response.status, 400);
        assert.equal(response.body.message, "Email must be a string.");
    });

    it("validates password-reset input", async () => {
        const client = createClient();

        const badToken = await client.post("/auth/reset-password/xyz", { password: "long-enough" });
        assert.equal(badToken.status, 400);
        assert.equal(badToken.body.message, "Invalid or expired reset token.");

        const shortPassword = await client.post(`/auth/reset-password/${"a".repeat(64)}`, { password: "1" });
        assert.equal(shortPassword.status, 400);
        assert.match(shortPassword.body.message, /at least 6 characters/);
    });
});
