import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// The address a request came from.
// Behind a hosting platform's proxy, req.ip is the proxy itself, so every visitor would share one limit.
// CLIENT_IP_HEADER names the header in which the platform passes the real address (on Render: cf-connecting-ip).
// Only set it to a header the platform itself overwrites, otherwise a caller could send a made-up address.
const clientAddress = (req) => {
    const header = process.env.CLIENT_IP_HEADER?.toLowerCase();
    const forwarded = header ? req.headers[header] : undefined;

    return ipKeyGenerator(
        typeof forwarded === "string" && forwarded ? forwarded : req.ip,
    );
};

// Limits that follow the account rather than the network: they hold no matter how the request reached us
const accountKey = (req) =>
    typeof req.body?.email === "string"
        ? `account:${req.body.email}`
        : clientAddress(req);

// Rate limiting middleware to limit repeated requests to public APIs and endpoints
const rateLimitMiddleware = rateLimit({
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

// Flood guard for the public auth endpoints, per address.
// Password guessing is stopped by the per-account limits below, so this one can afford to be roomy.
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    keyGenerator: clientAddress,
    message: {
        success: false,
        message:
            "Too many auth attempts from this IP, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// At most 5 failed logins per account per 15 minutes. Must run after the body is validated.
export const loginAccountRateLimit = rateLimit({
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

// At most 3 confirmation emails per address per hour, counting sign-up and "send it again" together.
// Must run after the body is validated.
export const verificationEmailRateLimit = rateLimit({
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

// At most 3 reset emails per account per hour. Must run after the body is validated.
export const passwordResetRateLimit = rateLimit({
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
