import User from "../models/User.js";
import DailyLog from "../models/DailyLog.js";

// @desc    Get overarching streak info and last 7 days of logs
// @route   GET /api/streaks/info
export const getStreakInfo = async (req, res, next) => {
    try {
        // Fetch only the specific streak fields to keep the payload tiny
        const user = await User.findById(req.user._id).select(
            "currentStreak bestStreak lastActiveDate",
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch the 7 most recent daily logs, sorting newest first
        const recentLogs = await DailyLog.find({ user: req.user._id })
            .sort({ date: -1 })
            .limit(7);

        res.status(200).json({
            currentStreak: user.currentStreak || 0,
            bestStreak: user.bestStreak || 0,
            lastActiveDate: user.lastActiveDate || "",
            recentLogs,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get historical daily logs for heatmap/analytics
// @route   GET /api/streaks/logs?days=30
export const getDailyLogs = async (req, res, next) => {
    try {
        // Default to 30 days if the query parameter isn't provided
        const limit = parseInt(req.query.days) || 30;

        const logs = await DailyLog.find({ user: req.user._id })
            .sort({ date: -1 }) // -1 sorts descending (newest first)
            .limit(limit);

        res.status(200).json({ logs });
    } catch (error) {
        next(error);
    }
};
