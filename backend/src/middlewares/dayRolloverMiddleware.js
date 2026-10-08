import { settleEndedDays } from "../utils/dailyPenaltyJob.js";

// Runs after 'protect'. If the user's day has ended since their last request, close it first
// (missed-task penalties, streaks), so whatever this request returns is already up to date.
// On every other request this is a single date comparison.
export const settleDays = async (req, res, next) => {
    try {
        await settleEndedDays(req.user);
    } catch (error) {
        // A failed settlement must not block the request; the next one tries again
        console.error("Day settlement error:", error);
    }
    next();
};
