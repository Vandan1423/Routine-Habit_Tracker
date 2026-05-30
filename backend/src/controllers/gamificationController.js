import User from "../models/User.js";
import XPLog from "../models/XPLog.js";
import { calculateLevel } from "../utils/xpCalculator.js";

// @desc    Get user's current gamification stats (Level, XP, Coins)
// @route   GET /api/gamification/stats
export const getStats = async (req, res) => {
    try {
        // Fetch a fresh copy of the user to ensure exact coin/XP sync
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Calculate all the level thresholds and progress percentage
        const levelInfo = calculateLevel(user.xp);

        // Return the combined stats
        res.status(200).json({
            level: levelInfo.level,
            currentXp: levelInfo.currentXp,
            xpForNext: levelInfo.xpForNext,
            totalXp: levelInfo.totalXp,
            progressPercentage: levelInfo.progressPercentage,
            coins: user.coins || 0,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching gamification stats",
            error: error.message,
        });
    }
};

// @desc    Get recent XP transaction history
// @route   GET /api/gamification/xp-history
export const getXPHistory = async (req, res) => {
    try {
        // Fetch the 20 most recent XP logs for the user
        const logs = await XPLog.find({ user: req.user._id })
            .sort({ createdAt: -1 }) // -1 sorts descending (newest first)
            .limit(20);

        res.status(200).json({ history: logs });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching XP history",
            error: error.message,
        });
    }
};
