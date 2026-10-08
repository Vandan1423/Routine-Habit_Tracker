import { verifyAccessToken } from "../config/jwt.js";
import User, { PRIVATE_USER_FIELDS } from "../models/User.js";
import {
    isValidTimezone,
    showSameTime,
    TIMEZONE_CHANGE_COOLDOWN_MS,
} from "../utils/dateRules.js";

// Clients report their timezone in the X-Timezone header. Store it when it changes,
// but not more often than the cooldown allows.
const syncTimezone = async (req, user) => {
    const reported = req.headers["x-timezone"];

    if (!isValidTimezone(reported) || reported === user.timezone) {
        return;
    }

    // Another name for the zone the account is already on: nothing to change
    if (showSameTime(reported, user.timezone)) {
        return;
    }

    const lastChange = user.timezoneUpdatedAt?.getTime() ?? 0;
    if (Date.now() - lastChange < TIMEZONE_CHANGE_COOLDOWN_MS) {
        return;
    }

    user.timezone = reported;
    user.timezoneUpdatedAt = new Date();
    await User.updateOne(
        { _id: user._id },
        { timezone: user.timezone, timezoneUpdatedAt: user.timezoneUpdatedAt },
    );
};

export const protect = async (req, res, next) => {
    try {
        let accessToken;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            accessToken = req.headers.authorization.split(" ")[1];
        }

        if (!accessToken) {
            return res
                .status(401)
                .json({ message: "Not authorized, no token", success: false });
        }

        // Verify token and extract payload
        const payload = verifyAccessToken(accessToken);

        if (!payload) {
            return res.status(401).json({
                message: "Not authorized, Invalid or expired token",
                success: false,
            });
        }

        // Find user by ID from payload. Credentials are left out, so req.user is safe to send in a response.
        const user = await User.findById(payload._id).select(
            PRIVATE_USER_FIELDS,
        );
        if (!user) {
            return res.status(401).json({
                message: "User not found, Invalid token",
                success: false,
            });
        }

        await syncTimezone(req, user);

        req.user = user; // Attach user to request object
        next(); // Proceed to next middleware or route handler
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        return res.status(401).json({
            success: false,
            message: "Not authorized. Authentication failed.",
        });
    }
};
