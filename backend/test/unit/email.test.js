import "../helpers/env.js";

import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    acceptEmails,
    outbox,
    refuseEmails,
    startEmailServer,
    stopEmailServer,
} from "../helpers/email.js";
import {
    passwordResetEmail,
    verificationEmail,
} from "../../src/utils/emailTemplates.js";

describe("sending email", () => {
    let sendEmail;

    before(async () => {
        // Loaded only once the stand-in server is up, see helpers/email.js
        await startEmailServer();
        ({ default: sendEmail } = await import("../../src/utils/sendEmail.js"));
    });
    after(stopEmailServer);
    beforeEach(() => {
        acceptEmails();
        process.env.EMAIL_FROM = "";
        process.env.RESEND_API_KEY = "re_test_key";
    });

    const message = { to: "someone@example.com", subject: "Hello", html: "<p>Hello</p>", text: "Hello" };

    it("uses Resend's test sender until EMAIL_FROM names a real one", async () => {
        await sendEmail(message);
        assert.equal(outbox.at(-1).from, "नित्यक्रम <onboarding@resend.dev>");

        process.env.EMAIL_FROM = "नित्यक्रम <hello@nityakram.example>";
        await sendEmail(message);
        assert.equal(outbox.at(-1).from, "नित्यक्रम <hello@nityakram.example>");
        assert.deepEqual(
            { to: outbox.at(-1).to, subject: outbox.at(-1).subject, html: outbox.at(-1).html, text: outbox.at(-1).text },
            message,
        );
    });

    it("fails out loud when Resend turns the email away", async () => {
        const sentBefore = outbox.length;
        refuseEmails("You can only send testing emails to your own email address.");

        await assert.rejects(sendEmail(message), /was not sent: You can only send testing emails/);
        assert.equal(outbox.length, sentBefore);
    });

    it("fails out loud when no email key is set", async () => {
        process.env.RESEND_API_KEY = "";
        await assert.rejects(sendEmail(message), /not configured/);
    });
});

describe("sending email through a Gmail account", () => {
    const TOKEN_URL = "https://oauth2.googleapis.com/token";
    const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const realFetch = globalThis.fetch;

    // What Google was asked, and what it will answer next (the last answer repeats)
    let tokenRequests;
    let sendRequests;
    let tokenAnswers;
    let sendAnswers;
    let imports = 0;

    const answer = (status, body) => new Response(JSON.stringify(body), { status });
    const next = (answers) => (answers.length > 1 ? answers.shift() : answers[0]);

    // sendEmail keeps Google's access token between emails, so every test loads a copy of its own
    const freshSendEmail = async () =>
        (await import(`../../src/utils/sendEmail.js?copy=${++imports}`)).default;

    before(() => {
        // Stands in for Google: nothing here ever reaches the real one
        globalThis.fetch = async (url, options) => {
            if (String(url) === TOKEN_URL) {
                tokenRequests.push(Object.fromEntries(options.body));
                return answer(...next(tokenAnswers));
            }
            if (String(url) === SEND_URL) {
                sendRequests.push({
                    authorization: options.headers.Authorization,
                    message: Buffer.from(JSON.parse(options.body).raw, "base64url").toString("utf8"),
                });
                return answer(...next(sendAnswers));
            }
            return realFetch(url, options);
        };
    });
    after(() => {
        globalThis.fetch = realFetch;
    });

    beforeEach(() => {
        tokenRequests = [];
        sendRequests = [];
        tokenAnswers = [[200, { access_token: "access-1", expires_in: 3599 }]];
        sendAnswers = [[200, { id: "sent" }]];
        process.env.GMAIL_CLIENT_ID = "client-id";
        process.env.GMAIL_CLIENT_SECRET = "client-secret";
        process.env.GMAIL_REFRESH_TOKEN = "refresh-token";
        process.env.EMAIL_FROM = "Nityakram <app@gmail.example>";
    });
    afterEach(() => {
        for (const name of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "EMAIL_FROM"]) {
            process.env[name] = "";
        }
    });

    const message = {
        to: "someone@example.com",
        subject: "Confirm your email",
        html: "<p>Héllo ✓ <a href=\"http://localhost:5173/verify-email/abc\">Confirm</a></p>",
        text: "Héllo ✓ http://localhost:5173/verify-email/abc",
    };

    // Splits a sent message into its headers and its decoded plain-text and HTML copies
    const read = (sent) => {
        const [head] = sent.split("\r\n\r\n");
        const boundary = head.match(/boundary="([^"]+)"/)[1];
        const bodies = Object.fromEntries(
            sent
                .split(`--${boundary}`)
                .slice(1, -1)
                .map((part) => {
                    const [partHead, encoded] = part.trim().split("\r\n\r\n");
                    return [
                        partHead.match(/Content-Type: ([^;]+)/)[1],
                        Buffer.from(encoded.replace(/\r\n/g, ""), "base64").toString("utf8"),
                    ];
                }),
        );
        return { headers: head.split("\r\n"), bodies };
    };

    it("signs in with the refresh token and hands Gmail the whole email", async () => {
        const sendEmail = await freshSendEmail();
        await sendEmail(message);

        assert.deepEqual(tokenRequests, [{
            client_id: "client-id",
            client_secret: "client-secret",
            refresh_token: "refresh-token",
            grant_type: "refresh_token",
        }]);
        assert.equal(sendRequests.length, 1);
        assert.equal(sendRequests[0].authorization, "Bearer access-1");

        const { headers, bodies } = read(sendRequests[0].message);
        assert.ok(headers.includes("From: Nityakram <app@gmail.example>"));
        assert.ok(headers.includes("To: someone@example.com"));
        assert.ok(headers.includes("Subject: Confirm your email"));
        assert.deepEqual(bodies, { "text/plain": message.text, "text/html": message.html });

        // Nothing went to Resend
        assert.equal(outbox.filter((email) => email.subject === message.subject).length, 0);
    });

    it("sends a name and a subject that are not in English letters as encoded words", async () => {
        process.env.EMAIL_FROM = "नित्यक्रम <app@gmail.example>";
        const subject = "Confirm your email for नित्यक्रम, and then sign in to नित्यक्रम to begin";

        const sendEmail = await freshSendEmail();
        await sendEmail({ ...message, subject });

        const [head] = sendRequests[0].message.split("\r\n\r\n");

        // Nothing but ASCII in the headers, and no line of encoded words longer than the 76 characters allowed
        assert.match(head, /^[\x20-\x7e\r\n]*$/);
        const encodedLines = head.split("\r\n").filter((line) => line.includes("=?UTF-8?"));
        assert.ok(encodedLines.length > 2);
        assert.ok(encodedLines.every((line) => line.length <= 76));

        // A reader's mail app joins the pieces back together: the break between two of them is not part of the text
        const decoded = head
            .replace(/\?=\r\n =\?/g, "?==?")
            .replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, encoded) => Buffer.from(encoded, "base64").toString("utf8"))
            .split("\r\n");

        assert.ok(decoded.includes("From: नित्यक्रम <app@gmail.example>"));
        assert.ok(decoded.includes(`Subject: ${subject}`));
    });

    it("keeps Google's access token for the next email", async () => {
        const sendEmail = await freshSendEmail();
        await sendEmail(message);
        await sendEmail(message);

        assert.equal(tokenRequests.length, 1);
        assert.equal(sendRequests.length, 2);
    });

    it("leaves the sender to Gmail when EMAIL_FROM isn't set", async () => {
        process.env.EMAIL_FROM = "";
        const sendEmail = await freshSendEmail();
        await sendEmail(message);

        const { headers } = read(sendRequests[0].message);
        assert.equal(headers.some((header) => header.startsWith("From:")), false);
    });

    it("encodes a subject that isn't plain English letters", async () => {
        const sendEmail = await freshSendEmail();
        await sendEmail({ ...message, subject: "Bestätige deine E-Mail ✓" });

        const subject = read(sendRequests[0].message).headers.find((header) => header.startsWith("Subject: "));
        const encoded = subject.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/)[1];
        assert.equal(Buffer.from(encoded, "base64").toString("utf8"), "Bestätige deine E-Mail ✓");
    });

    it("can't be given extra headers through an address or a subject", async () => {
        const sendEmail = await freshSendEmail();
        await sendEmail({
            ...message,
            to: "someone@example.com\r\nBcc: thief@example.com",
            subject: "Hello\r\nBcc: thief@example.com",
        });

        const { headers } = read(sendRequests[0].message);
        assert.equal(headers.some((header) => header.startsWith("Bcc:")), false);
    });

    it("gets a fresh access token when Gmail stops accepting the one it kept", async () => {
        const sendEmail = await freshSendEmail();
        tokenAnswers = [
            [200, { access_token: "access-1", expires_in: 3599 }],
            [200, { access_token: "access-2", expires_in: 3599 }],
        ];
        sendAnswers = [[401, { error: { message: "Invalid Credentials" } }], [200, { id: "sent" }]];

        await sendEmail(message);

        assert.deepEqual(sendRequests.map((request) => request.authorization), ["Bearer access-1", "Bearer access-2"]);
    });

    it("fails out loud when Google no longer accepts the refresh token", async () => {
        const sendEmail = await freshSendEmail();
        tokenAnswers = [[400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }]];

        await assert.rejects(sendEmail(message), /Google refused GMAIL_REFRESH_TOKEN: Token has been expired or revoked\./);
        assert.equal(sendRequests.length, 0);
    });

    it("fails out loud when Gmail turns the email away", async () => {
        const sendEmail = await freshSendEmail();
        sendAnswers = [[403, { error: { message: "Daily user sending limit exceeded." } }]];

        await assert.rejects(sendEmail(message), /someone@example\.com was not sent: Daily user sending limit exceeded\./);
    });

    it("fails out loud when only some of the Gmail settings are there", async () => {
        process.env.GMAIL_REFRESH_TOKEN = "";
        const sendEmail = await freshSendEmail();

        await assert.rejects(sendEmail(message), /Gmail sending is missing GMAIL_REFRESH_TOKEN/);
        assert.equal(tokenRequests.length, 0);
        assert.equal(outbox.filter((email) => email.subject === message.subject).length, 0);
    });
});

describe("email templates", () => {
    it("put the link in both the HTML and the plain-text copy", () => {
        const url = `http://localhost:5173/verify-email/${"a".repeat(64)}`;
        const email = verificationEmail({ name: "Asha", url });

        assert.match(email.subject, /Confirm your email/);
        assert.ok(email.html.includes(`href="${url}"`));
        assert.ok(email.text.includes(url));
        assert.match(email.text, /Hi Asha,/);
    });

    it("escape a name in the HTML, and leave it as typed in the plain text", () => {
        const email = verificationEmail({ name: `Tom & "Jerry" <b>`, url: "http://localhost:5173/x" });

        assert.match(email.html, /Hi Tom &amp; &quot;Jerry&quot; &lt;b&gt;,/);
        assert.match(email.text, /Hi Tom & "Jerry" <b>,/);
    });

    it("say how long each link lasts", () => {
        assert.match(verificationEmail({ name: "A", url: "u" }).text, /valid for 24 hours/);
        assert.match(passwordResetEmail({ url: "u" }).text, /valid for 15 minutes/);
    });
});
