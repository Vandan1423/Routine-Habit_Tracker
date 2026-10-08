import crypto from "crypto";
import { Resend } from "resend";

// Resend's shared test sender. It only delivers to the address the Resend account was opened with,
// so to reach anyone else through Resend, EMAIL_FROM has to be an address on a domain verified there.
const TEST_SENDER = "Life Tracker <onboarding@resend.dev>";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_SETTINGS = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
];
const GOOGLE_TIMEOUT_MS = 15 * 1000;

// Emails go out through a Gmail account as soon as any of its settings is present, otherwise through Resend.
// (`npm run gmail:token` creates the refresh token.)
const usesGmail = () => GMAIL_SETTINGS.some((name) => process.env[name]);

// True while emails can only reach the Resend account's own address
export const usesTestSender = () => !usesGmail() && !process.env.EMAIL_FROM;

// Google trades the long-lived refresh token for an access token that works for about an hour.
// It is kept until shortly before it runs out.
let gmailAccess = { token: null, expiresAt: 0 };

const getGmailAccessToken = async () => {
    if (gmailAccess.token && Date.now() < gmailAccess.expiresAt) {
        return gmailAccess.token;
    }

    const missing = GMAIL_SETTINGS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Gmail sending is missing ${missing.join(", ")}.`);
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        // "invalid_grant" means the refresh token was withdrawn or ran out; `npm run gmail:token` makes a new one
        throw new Error(
            `Google refused GMAIL_REFRESH_TOKEN: ${body.error_description || body.error || response.status}`,
        );
    }

    gmailAccess = {
        token: body.access_token,
        expiresAt: Date.now() + (body.expires_in - 60) * 1000,
    };

    return gmailAccess.token;
};

// A header may never carry a line break: that would let its value start a header of its own
const headerValue = (value) => String(value).replace(/[\r\n]+/g, " ");

const subjectHeader = (subject) =>
    /^[\x20-\x7e]*$/.test(subject)
        ? subject
        : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;

const base64Lines = (content) =>
    (Buffer.from(content, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

// The whole email as one piece of text, the way mail servers pass it along:
// the headers first, then the plain-text and HTML copies of the body
const buildMimeMessage = ({ from, to, subject, html, text }) => {
    const boundary = `life-tracker-${crypto.randomUUID()}`;
    const bodies = [
        ["text/plain", text],
        ["text/html", html],
    ].filter(([, content]) => content);

    return [
        ...(from ? [`From: ${headerValue(from)}`] : []),
        `To: ${headerValue(to)}`,
        `Subject: ${subjectHeader(headerValue(subject))}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        ...bodies.flatMap(([type, content]) => [
            `--${boundary}`,
            `Content-Type: ${type}; charset=UTF-8`,
            "Content-Transfer-Encoding: base64",
            "",
            base64Lines(content),
        ]),
        `--${boundary}--`,
        "",
    ].join("\r\n");
};

const sendWithGmail = async (email) => {
    const raw = Buffer.from(buildMimeMessage(email), "utf8").toString("base64url");

    const send = async () =>
        fetch(GMAIL_SEND_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await getGmailAccessToken()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
            signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
        });

    let response = await send();

    if (response.status === 401) {
        // The kept access token stopped working early: get a fresh one and try once more
        gmailAccess = { token: null, expiresAt: 0 };
        response = await send();
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
            `Email to ${email.to} was not sent: ${body.error?.message || response.status}`,
        );
    }
};

const sendWithResend = async (email) => {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Email service is not configured.");
    }

    // Created here, not when the file loads: without a key the constructor throws,
    // and a missing email key must not stop the whole server from starting
    const resend = new Resend(process.env.RESEND_API_KEY);

    // A refused email does not throw: the client hands the reason back instead
    const { error } = await resend.emails.send({
        ...email,
        from: email.from || TEST_SENDER,
    });

    if (error) {
        throw new Error(`Email to ${email.to} was not sent: ${error.message}`);
    }
};

const sendEmail = async ({ to, subject, html, text }) => {
    const email = { from: process.env.EMAIL_FROM, to, subject, html, text };

    // Gmail always sends from the account's own address. There EMAIL_FROM only sets the name shown beside it,
    // e.g. "Life Tracker <the.account@gmail.com>"; without it Gmail uses the account's own name.
    return usesGmail() ? sendWithGmail(email) : sendWithResend(email);
};

export default sendEmail;
