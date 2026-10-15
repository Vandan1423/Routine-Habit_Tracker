import RateLimitHit from "../models/RateLimitHit.js";

/**
 * Where express-rate-limit keeps its counts when the app runs as several copies at once (on Vercel, each
 * instance of the function has a memory of its own). Here every copy counts in the database, against one budget.
 * Make one per limiter, each with its own prefix, so two limiters never share a row.
 */
export class DatabaseStore {
    // Counts are shared, not kept per copy (express-rate-limit checks this to catch a key counted twice)
    localKeys = false;

    constructor(prefix) {
        this.prefix = `${prefix}:`;
        this.windowMs = 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async get(key) {
        const row = await RateLimitHit.findById(this.prefix + key).lean();
        if (!row || row.resetAt <= new Date()) return undefined;
        return { totalHits: row.hits, resetTime: row.resetAt };
    }

    // One more hit, in a single step so two requests at once both count. A window that has ended starts again.
    async increment(key) {
        const now = new Date();
        const running = { $gt: ["$resetAt", now] };
        const row = await RateLimitHit.collection.findOneAndUpdate(
            { _id: this.prefix + key },
            [
                {
                    $set: {
                        hits: { $cond: [running, { $add: ["$hits", 1] }, 1] },
                        resetAt: {
                            $cond: [running, "$resetAt", new Date(now.getTime() + this.windowMs)],
                        },
                    },
                },
            ],
            { upsert: true, returnDocument: "after" },
        );
        return { totalHits: row.hits, resetTime: row.resetAt };
    }

    async decrement(key) {
        await RateLimitHit.updateOne(
            { _id: this.prefix + key, resetAt: { $gt: new Date() }, hits: { $gt: 0 } },
            { $inc: { hits: -1 } },
        );
    }

    async resetKey(key) {
        await RateLimitHit.deleteOne({ _id: this.prefix + key });
    }
}
