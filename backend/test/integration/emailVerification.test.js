import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    uniqueEmail,
} from "../helpers/app.js";
import {
    acceptEmails,
    emailsTo,
    refuseEmails,
    tokenIn,
    waitForEmailTo,
} from "../helpers/email.js";
import User from "../../src/models/User.js";

describe("emails", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);
    beforeEach(acceptEmails);

    const confirm = (token) => createClient().post(`/auth/verify-email/${token}`);
    const resend = (email) => createClient().post("/auth/resend-verification", { email });
    const linkTokenFor = (email) => tokenIn(emailsTo(email).at(-1));

    describe("confirming a new account", () => {
        it("signs up without signing in, and emails a link", async () => {
            const { email, response } = await createClient().signUp({ name: "Asha" });

            assert.equal(response.status, 201);
            assert.equal(response.body.verificationRequired, true);
            assert.equal(response.body.email, email);
            assert.equal(response.body.accessToken, undefined);
            assert.equal(response.body.user, undefined);
            assert.equal(response.setCookie, undefined);

            const [sent] = emailsTo(email);
            assert.equal(emailsTo(email).length, 1);
            assert.equal(sent.from, "Nitya <onboarding@resend.dev>");
            assert.match(sent.subject, /Confirm your email/);
            assert.match(sent.html, /Hi Asha,/);
            assert.match(sent.html, /href="http:\/\/localhost:5173\/verify-email\/[0-9a-f]{64}"/);
            assert.match(sent.text, /http:\/\/localhost:5173\/verify-email\/[0-9a-f]{64}/);
        });

        it("keeps the account closed until the link is opened", async () => {
            const client = createClient();
            const account = await client.signUp();

            const early = await client.login(account);
            assert.equal(early.status, 403);
            assert.equal(early.body.code, "EMAIL_NOT_VERIFIED");
            assert.equal(early.body.accessToken, undefined);
            assert.equal(early.setCookie, undefined);

            // A wrong password is answered as for any other account
            const wrong = await createClient().post("/auth/login", { email: account.email, password: "not-the-password" });
            assert.equal(wrong.status, 400);

            const token = linkTokenFor(account.email);
            assert.equal((await confirm(token)).status, 200);

            const late = await client.login(account);
            assert.equal(late.status, 200);
            assert.equal(late.body.user.emailVerified, true);
            assert.equal((await client.get("/habits")).status, 200);

            // Opening the link again (a double click, a mail app that opens links itself) is not an error
            assert.equal((await confirm(token)).status, 200);
        });

        it("never stores the link's token itself", async () => {
            const { email } = await createClient().signUp();
            const user = await User.findOne({ email });

            assert.equal(user.emailVerified, false);
            assert.match(user.emailVerificationToken, /^[0-9a-f]{64}$/);
            assert.notEqual(user.emailVerificationToken, linkTokenFor(email));
        });

        it("refuses links that are made up, malformed or expired", async () => {
            const client = createClient();
            const account = await client.signUp();

            assert.equal((await confirm("a".repeat(64))).status, 400);
            assert.equal((await confirm("not-a-token")).status, 400);

            await User.updateOne({ email: account.email }, { emailVerificationExpiry: new Date(Date.now() - 1000) });
            const expired = await confirm(linkTokenFor(account.email));
            assert.equal(expired.status, 400);
            assert.match(expired.body.message, /invalid or has expired/);
            assert.equal((await client.login(account)).status, 403);
        });

        it("escapes whatever was typed as a name", async () => {
            const { email } = await createClient().signUp({ name: '<img src=x onerror="alert(1)">' });
            const [sent] = emailsTo(email);

            assert.doesNotMatch(sent.html, /<img/);
            assert.match(sent.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
        });
    });

    describe("sending the link again", () => {
        it("replaces the earlier link", async () => {
            const client = createClient();
            const account = await client.signUp();
            const firstToken = linkTokenFor(account.email);

            const again = await resend(account.email);
            assert.equal(again.status, 200);
            const secondToken = tokenIn(await waitForEmailTo(account.email, 2));

            assert.notEqual(secondToken, firstToken);
            assert.equal((await confirm(firstToken)).status, 400);
            assert.equal((await confirm(secondToken)).status, 200);
            assert.equal((await client.login(account)).status, 200);
        });

        it("answers the same for every address, and only emails accounts that are waiting", async () => {
            const waiting = await createClient().signUp();
            const confirmed = await createClient().register();
            const nobody = uniqueEmail("nobody");

            const answers = [];
            for (const email of [waiting.email, confirmed.email, nobody]) {
                const response = await resend(email);
                answers.push([response.status, response.body.message]);
            }
            assert.equal(new Set(answers.map(String)).size, 1);
            assert.equal(answers[0][0], 200);

            await waitForEmailTo(waiting.email, 2);
            assert.equal(emailsTo(confirmed.email).length, 1);
            assert.equal(emailsTo(nobody).length, 0);
        });

        it("stops at 3 confirmation emails per address per hour", async () => {
            const { email } = await createClient().signUp();

            assert.equal((await resend(email)).status, 200);
            assert.equal((await resend(email)).status, 200);
            assert.equal((await resend(email)).status, 429);

            // Signing up again for the same address is held back by the same limit
            assert.equal((await createClient().signUp({ email })).response.status, 429);

            await waitForEmailTo(email, 3);
            assert.equal(emailsTo(email).length, 3);
        });
    });

    describe("signing up for an address again", () => {
        it("starts an unconfirmed account over", async () => {
            const first = await createClient().signUp();
            const firstToken = linkTokenFor(first.email);

            const client = createClient();
            const second = await client.signUp({ email: first.email, name: "Second Try" });
            assert.equal(second.response.status, 201);

            assert.equal((await confirm(firstToken)).status, 400);
            assert.equal((await confirm(linkTokenFor(first.email))).status, 200);

            // Only the latest sign-up's password opens the account
            assert.equal((await createClient().login(first)).status, 400);
            const login = await client.login(second);
            assert.equal(login.status, 200);
            assert.equal(login.body.user.name, "Second Try");
            assert.equal(await User.countDocuments({ email: first.email }), 1);
        });

        it("refuses once the account is confirmed", async () => {
            const { email } = await createClient().register();
            const second = await createClient().signUp({ email });

            assert.equal(second.response.status, 400);
            assert.equal(emailsTo(email).length, 1);
        });
    });

    describe("when the email can't be sent", () => {
        it("says so at sign-up, and lets the same sign-up be tried again", async () => {
            const client = createClient();
            const email = uniqueEmail();

            refuseEmails();
            const failed = await client.signUp({ email });
            assert.equal(failed.response.status, 503);
            assert.match(failed.response.body.message, /couldn't send the confirmation email/);
            assert.equal(emailsTo(email).length, 0);

            acceptEmails();
            const retried = await client.signUp({ email });
            assert.equal(retried.response.status, 201);
            assert.equal((await confirm(linkTokenFor(email))).status, 200);
            assert.equal((await client.login(retried)).status, 200);
        });

        it("still answers a reset request the usual way", async () => {
            const { email } = await createClient().register();

            refuseEmails();
            const response = await createClient().post("/auth/forgot-password", { email });
            assert.equal(response.status, 200);
            assert.match(response.body.message, /If that email exists/);

            // Only the confirmation email from signing up ever arrived
            await new Promise((resolve) => setTimeout(resolve, 200));
            assert.equal(emailsTo(email).length, 1);
        });
    });

    describe("resetting a password", () => {
        const requestReset = (email) => createClient().post("/auth/forgot-password", { email });
        const resetEmailTo = async (email, count) => {
            const sent = await waitForEmailTo(email, count);
            assert.match(sent.subject, /Reset your Nitya password/);
            return sent;
        };

        it("emails a link that sets a new password and signs every device out", async () => {
            const client = createClient();
            const account = await client.register();

            assert.equal((await requestReset(account.email)).status, 200);
            const sent = await resetEmailTo(account.email, 2);
            assert.match(sent.html, /href="http:\/\/localhost:5173\/reset-password\/[0-9a-f]{64}"/);

            const token = tokenIn(sent);
            const reset = await createClient().post(`/auth/reset-password/${token}`, { password: "a-brand-new-password" });
            assert.equal(reset.status, 200);

            assert.equal((await client.post("/auth/refresh-token")).status, 401);
            assert.equal((await createClient().login(account)).status, 400);
            assert.equal((await createClient().login({ ...account, password: "a-brand-new-password" })).status, 200);

            // A link works once
            const reused = await createClient().post(`/auth/reset-password/${token}`, { password: "another-password" });
            assert.equal(reused.status, 400);
        });

        it("confirms the email as well, since the link arrived there", async () => {
            const account = await createClient().signUp();

            await requestReset(account.email);
            const token = tokenIn(await resetEmailTo(account.email, 2));
            await createClient().post(`/auth/reset-password/${token}`, { password: "a-brand-new-password" });

            const login = await createClient().login({ ...account, password: "a-brand-new-password" });
            assert.equal(login.status, 200);
            assert.equal(login.body.user.emailVerified, true);
        });

        it("never returns the stored reset token", async () => {
            const client = createClient();
            const account = await client.register();

            await requestReset(account.email);
            await resetEmailTo(account.email, 2);

            const me = await client.get("/auth/me");
            assert.equal(me.body.user.passwordResetToken, undefined);
            assert.equal(me.body.user.passwordResetExpiry, undefined);
        });
    });

    describe("with EMAIL_VERIFICATION_REQUIRED set to false", () => {
        before(() => {
            process.env.EMAIL_VERIFICATION_REQUIRED = "false";
        });
        after(() => {
            process.env.EMAIL_VERIFICATION_REQUIRED = "";
        });

        it("signs a new account in straight away and sends nothing", async () => {
            const client = createClient();
            const { email, response } = await client.signUp();

            assert.equal(response.status, 201);
            assert.ok(response.body.accessToken);
            assert.ok(response.cookie);
            assert.equal(response.body.user.emailVerified, true);
            assert.equal(emailsTo(email).length, 0);

            client.accessToken = response.body.accessToken;
            assert.equal((await client.get("/auth/me")).status, 200);
        });

        it("lets in an account that was still waiting to be confirmed", async () => {
            process.env.EMAIL_VERIFICATION_REQUIRED = "";
            const account = await createClient().signUp();
            process.env.EMAIL_VERIFICATION_REQUIRED = "false";

            assert.equal((await createClient().login(account)).status, 200);
        });
    });

    describe("accounts from before confirmation existed", () => {
        it("count as confirmed", async () => {
            const client = createClient();
            const account = await client.register();

            // Put the stored account back to how older ones look: no confirmation fields at all
            await User.collection.updateOne(
                { email: account.email },
                { $unset: { emailVerified: "", emailVerificationToken: "", emailVerificationExpiry: "" } },
            );

            const login = await createClient().login(account);
            assert.equal(login.status, 200);
            assert.equal(login.body.user.emailVerified, true);
            assert.equal((await createClient().signUp({ email: account.email })).response.status, 400);
        });
    });
});
