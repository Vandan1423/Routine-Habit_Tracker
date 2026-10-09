import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    uniqueEmail,
} from "../helpers/app.js";
import User from "../../src/models/User.js";

describe("sessions", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const refresh = (client, cookie) =>
        client.post("/auth/refresh-token", {}, { cookie });

    it("signs in without ever exposing credentials", async () => {
        const client = createClient();
        const { login: response } = await client.register();

        assert.equal(response.status, 200);
        assert.ok(response.body.accessToken);
        assert.match(response.setCookie, /HttpOnly/);
        assert.match(response.setCookie, /SameSite=Lax/);

        // The long-lived token lives only in the cookie, never in a body a page script could read
        assert.equal(response.body.refreshToken, undefined);
        assert.equal(response.body.user.password, undefined);
        assert.equal(response.body.user.refreshTokens, undefined);
        assert.equal(response.body.user.emailVerificationToken, undefined);

        const me = await client.get("/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.body.user.password, undefined);
        assert.equal(me.body.user.refreshTokens, undefined);
        assert.equal(me.body.user.emailVerificationToken, undefined);
        assert.equal(me.body.user.emailVerified, true);
    });

    it("logs in whatever the case of the email, and refuses a wrong password", async () => {
        const client = createClient();
        const { email, password } = await client.register();

        const upper = await createClient().post("/auth/login", { email: email.toUpperCase(), password });
        assert.equal(upper.status, 200);

        const wrong = await createClient().post("/auth/login", { email, password: "not-the-password" });
        assert.equal(wrong.status, 400);
    });

    it("never opens a second account for the same email", async () => {
        const email = uniqueEmail();
        const first = await createClient().register({ email });
        const second = await createClient().signUp({ email });

        // Answered like any other sign-up (see the emails tests), and with no session
        assert.equal(second.response.status, 201);
        assert.equal(second.response.body.accessToken, undefined);
        assert.equal(second.response.setCookie, undefined);

        assert.equal(await User.countDocuments({ email }), 1);
        assert.equal((await createClient().login(second)).status, 400);
        assert.equal((await createClient().login(first)).status, 200);
    });

    it("never stores a refresh token itself", async () => {
        const client = createClient();
        const { email, login } = await client.register();
        const rotated = await refresh(client, login.cookie);

        const { refreshTokens } = await User.findOne({ email });
        const stored = JSON.stringify(refreshTokens);

        assert.equal(refreshTokens.length, 1);
        assert.match(refreshTokens[0].token, /^[0-9a-f]{64}$/);
        assert.match(refreshTokens[0].previousToken, /^[0-9a-f]{64}$/);
        // Neither the token in use nor the one it replaced, nor the signature that makes either one valid
        for (const token of [login.cookie, rotated.cookie]) {
            assert.ok(!stored.includes(token));
            assert.ok(!stored.includes(token.split(".")[2]));
        }
    });

    it("ends a session that was stored before tokens were hashed", async () => {
        const client = createClient();
        const account = await client.register();
        const user = await User.findOne({ email: account.email });

        // As sessions used to be kept: the token itself, and nothing else
        const old = user.generateRefreshToken();
        await User.updateOne({ _id: user._id }, { $push: { refreshTokens: { token: old } } });

        assert.equal((await refresh(createClient(), old)).status, 401);

        // Signing in clears it away
        await createClient().login(account);
        const { refreshTokens } = await User.findById(user._id);
        assert.ok(refreshTokens.length >= 1);
        assert.ok(refreshTokens.every((session) => session.token !== old && session.tokenId));
    });

    it("rotates the refresh token and keeps the session going", async () => {
        const client = createClient();
        const first = (await client.register()).login.cookie;

        const rotated = await refresh(client, first);
        assert.equal(rotated.status, 200);
        assert.ok(rotated.cookie);
        assert.notEqual(rotated.cookie, first);
        assert.equal(rotated.body.refreshToken, undefined);

        client.accessToken = rotated.body.accessToken;
        assert.equal((await client.get("/auth/me")).status, 200);
    });

    it("survives a refresh whose response never arrived", async () => {
        const client = createClient();
        const held = (await client.register()).login.cookie;
        const current = (await refresh(client, held)).cookie;

        // The browser still holds the replaced token: it gets the session's current one back
        const replay = await refresh(client, held);
        assert.equal(replay.status, 200);
        assert.equal(replay.cookie, current);

        // Once the new token has been used, the old one is finished
        await refresh(client, current);
        assert.equal((await refresh(client, held)).status, 401);
    });

    it("gives parallel refreshes of one token the same answer", async () => {
        const client = createClient();
        const token = (await client.register()).login.cookie;

        const results = await Promise.all(
            Array.from({ length: 6 }, () => refresh(client, token)),
        );
        assert.ok(results.every((result) => result.status === 200));
        assert.equal(new Set(results.map((result) => result.cookie)).size, 1);

        assert.equal((await refresh(client, results[0].cookie)).status, 200);
    });

    it("keeps sessions on different devices independent", async () => {
        const laptop = createClient();
        const { email, password } = await laptop.register();
        const laptopToken = laptop.refreshCookie;

        const phone = createClient();
        const phoneLogin = await phone.post("/auth/login", { email, password });
        phone.accessToken = phoneLogin.body.accessToken;

        const laptopNext = await refresh(laptop, laptopToken);
        assert.equal((await refresh(phone, phoneLogin.cookie)).status, 200);

        // Logging out with a token that was already replaced still ends that session, and only that one
        laptop.accessToken = laptopNext.body.accessToken;
        const logout = await laptop.post("/auth/logout", {}, { cookie: laptopToken });
        assert.equal(logout.status, 200);
        assert.equal((await refresh(laptop, laptopNext.cookie)).status, 401);

        const phoneLoginAgain = await phone.post("/auth/login", { email, password });
        assert.equal((await refresh(phone, phoneLoginAgain.cookie)).status, 200);
    });

    it("logs out everywhere", async () => {
        const client = createClient();
        const { email, password } = await client.register();
        const other = await createClient().post("/auth/login", { email, password });

        assert.equal((await client.post("/auth/logout-all")).status, 200);
        assert.equal((await refresh(client, client.refreshCookie)).status, 401);
        assert.equal((await refresh(client, other.cookie)).status, 401);
    });

    it("locks one account after 5 failed logins without touching others", async () => {
        const victim = createClient();
        const { email, password } = await victim.register();
        const bystander = await createClient().register();

        const attacker = createClient();
        const statuses = [];
        for (let i = 0; i < 6; i++) {
            statuses.push((await attacker.post("/auth/login", { email, password: "guess" })).status);
        }
        assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);

        // Even the right password waits out the lock, from any address
        assert.equal((await createClient().post("/auth/login", { email, password })).status, 429);

        const fine = await createClient().post("/auth/login", {
            email: bystander.email,
            password: bystander.password,
        });
        assert.equal(fine.status, 200);
    });

    it("answers a reset request the same way whether or not the account exists", async () => {
        const response = await createClient().post("/auth/forgot-password", { email: uniqueEmail("nobody") });
        assert.equal(response.status, 200);
        assert.match(response.body.message, /If that email exists/);
    });
});
