import crypto from "node:crypto";

import ExpressError from "../utils/ExpressError.js";
import { sweepEndedDays } from "../utils/dailyPenaltyJob.js";
import { purgeExpiredTrash } from "../utils/trashKinds.js";
import { sendDueReminders } from "../utils/reminders.js";

// The background jobs, as requests. A long-running server (server.js) runs them on a timer of its own; on Vercel
// nothing runs between requests, so a scheduler calls these instead: Vercel Cron for the daily one, and any
// scheduler that can call a URL every minute for reminders.
// Only a caller holding CRON_SECRET may start one, sent as "Authorization: Bearer <secret>" (Vercel Cron sends
// exactly that once CRON_SECRET is set on the project).

const sameSecret = (given, secret) => {
    const a = Buffer.from(given);
    const b = Buffer.from(secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const scheduledOnly = (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return next(new ExpressError(404, "Page Not Found"));
    }

    const given = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    if (!sameSecret(given, secret)) {
        return next(new ExpressError(401, "Not allowed."));
    }
    next();
};

// Once a day: close the days that have ended for everyone (each account's own next request does the same for
// it, so this is for the accounts nobody opens), and let go of what has stayed in Trash past its time.
export const runDaily = async (req, res) => {
    await sweepEndedDays();
    const purged = await purgeExpiredTrash();
    res.json({ success: true, purged });
};

// Every minute: the reminders that have come due. Does nothing without push keys (see config/push.js).
export const runReminders = async (req, res) => {
    const sent = await sendDueReminders();
    res.json({ success: true, sent });
};
