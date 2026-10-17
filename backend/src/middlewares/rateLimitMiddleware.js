import { isIP } from "node:net";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import { DatabaseStore } from "../utils/rateLimitStore.js";

// The address a request came from.
// Behind a hosting platform's proxy, req.ip is the proxy itself, so every visitor would share one limit.
// CLIENT_IP_HEADER names the header in which the platform passes the real address (on Render: cf-connecting-ip).
// Only set it to a header the platform itself overwrites, otherwise a caller could send a made-up address.
// On Vercel it need not be set: Vercel writes the address in x-vercel-forwarded-for and overwrites any sent.
const clientAddress = (req) => {
    const header = (
        process.env.CLIENT_IP_HEADER || (process.env.VERCEL ? "x-vercel-forwarded-for" : "")
    ).toLowerCase();
    const forwarded = header ? req.headers[header] : undefined;

    return ipKeyGenerator(
        typeof forwarded === "string" && forwarded ? forwarded : req.ip,
    );
};

// The visitor's own address, as the website's server reports it when it passes a request on to us.
// The website reaches this API from its host's servers, so clientAddress is one of those for every visitor.
// VISITOR_IP_HEADER names the header that host writes the visitor's address in (from Vercel: x-forwarded-for,
// which later proxies add to, so the first entry is read).
// Unlike CLIENT_IP_HEADER, someone calling the API directly can put anything here. So it is never used alone:
// it only divides the budget of the address it arrived from (visitorKey), and authAddressRateLimit caps how
// much one address can get by claiming many visitors.
const visitorAddress = (req) => {
    const header = process.env.VISITOR_IP_HEADER?.toLowerCase();
    const claimed = header ? req.headers[header] : undefined;
    const first = typeof claimed === "string" ? claimed.split(",")[0].trim() : "";

    return isIP(first) ? ipKeyGenerator(first) : null;
};

// One visitor behind one address. A made-up visitor cannot use up anyone's budget but its own address's.
const visitorKey = (req) => {
    const visitor = visitorAddress(req);
    return visitor ? `${clientAddress(req)}|${visitor}` : clientAddress(req);
};

// Limits that follow the account rather than the network: they hold no matter how the request reached us
const accountKey = (req) =>
    typeof req.body?.email === "string"
        ? `account:${req.body.email}`
        : clientAddress(req);

// Where a limit keeps its counts. On Vercel the app runs as several copies at once, each with a memory of its own,
// so the counts go in the database and every copy counts against the same budget. Anywhere else (one server,
// the tests) they stay in memory. name: this limit's own prefix in the database
const countedIn = (name) => (process.env.VERCEL ? { store: new DatabaseStore(name) } : {});

// Rate limiting middleware to limit repeated requests to public APIs and endpoints
const rateLimitMiddleware = rateLimit({
    ...countedIn("general"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
    message: {
        success: false,
        message:
            "Too many requests from this IP, please try again after 15 minutes",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

export default rateLimitMiddleware;

const AUTH_LIMIT_MESSAGE = {
    success: false,
    message:
        "Too many auth attempts from this IP, please try again after 15 minutes",
};

// Everything one address may send to the public auth endpoints, whoever it says it is sending for.
// Ten visitors' worth: room for the people who reach us through the same server of the website's host.
const authAddressRateLimit = rateLimit({
    ...countedIn("auth-address"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    keyGenerator: clientAddress,
    message: AUTH_LIMIT_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
});

const authVisitorRateLimit = rateLimit({
    ...countedIn("auth-visitor"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    keyGenerator: visitorKey,
    message: AUTH_LIMIT_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
});

// Flood guard for the public auth endpoints: 30 requests per visitor per 15 minutes, and 300 per address.
// The address's cap runs first, so a refused request never opens a new visitor's count.
// Password guessing is stopped by the per-account limits below, so this one can afford to be roomy.
export const authRateLimit = [authAddressRateLimit, authVisitorRateLimit];

// At most 5 failed logins per account per 15 minutes. Must run after the body is validated.
export const loginAccountRateLimit = rateLimit({
    ...countedIn("login"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: accountKey,
    skipSuccessfulRequests: true, // a correct password never counts against the account
    message: {
        success: false,
        message:
            "Too many failed login attempts for this account, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// At most 5 wrong passwords per account per 15 minutes on the requests that ask a signed-in person for their
// password again (changing it, deleting the account). Without this, a borrowed session could be used to guess it.
// Must run after `protect`.
export const passwordCheckRateLimit = rateLimit({
    ...countedIn("password-check"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req) => `password-check:${req.user._id}`,
    skipSuccessfulRequests: true, // the right password never counts against the account
    message: {
        success: false,
        message:
            "Too many wrong passwords for this account, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// At most 3 confirmation emails per address per hour, counting sign-up and "send it again" together.
// Must run after the body is validated.
export const verificationEmailRateLimit = rateLimit({
    ...countedIn("verification-email"),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    keyGenerator: accountKey,
    skipFailedRequests: true, // a sign-up that was refused sent no email
    message: {
        success: false,
        message:
            "Too many confirmation emails requested for this address, please try again in an hour",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// At most 600 MCP requests per account per 15 minutes, through Claude. A long planning conversation makes a few
// hundred; this stops a runaway loop, not a person. Keyed by account, because every Claude user's requests come
// from the same few addresses of Anthropic's. Must run after `requireConnection`.
export const connectorRateLimit = rateLimit({
    ...countedIn("connector"),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600,
    keyGenerator: (req) => `connector:${req.user._id}`,
    message: {
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Too many requests from Claude for this account. Try again in 15 minutes.",
        },
        id: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// At most 3 reset emails per account per hour. Must run after the body is validated.
export const passwordResetRateLimit = rateLimit({
    ...countedIn("password-reset"),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    keyGenerator: accountKey,
    message: {
        success: false,
        message:
            "Too many password reset requests for this account, please try again in an hour",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
