import mongoose from "mongoose";

import ExpressError from "../utils/ExpressError.js";

// The connection being opened, shared by every request that arrives meanwhile
let opening = null;

const open = () => {
    const { connection } = mongoose;

    if (connection.readyState === 1) return null; // connected
    if (connection.readyState === 2) return connection.asPromise(); // on its way

    opening ??= mongoose.connect(process.env.MONGO_URI).finally(() => {
        opening = null;
    });
    return opening;
};

/**
 * Makes sure the database is connected before a request is handled.
 * As a long-running server (server.js) the connection is opened at start, and this passes straight through.
 * On Vercel there is no start: each instance of the function opens it on its first request and keeps it for
 * the ones after. A connection that fails is tried again by the next request rather than ending the process.
 */
export const databaseReady = async (req, res, next) => {
    // Tests connect to a database of their own; nothing here may ever open the one named in .env for them
    if (process.env.NODE_ENV === "test") return next();

    try {
        await open();
    } catch (error) {
        console.error("Error connecting to Database:", error);
        return next(
            new ExpressError(503, "The server can't reach its database right now. Try again in a moment."),
        );
    }
    next();
};
