import User from "../models/User.js";
import XPLog from "../models/XPLog.js"; // 1. Import the new model
import { calculateLevel } from "./xpCalculator.js";

/**
 * Awards XP to a user, handles level-up logic, grants coin rewards, and logs the transaction.
 * @param {String} userId - The database ID of the user
 * @param {Number} xpAmount - The amount of XP to award
 * @param {String} reason - The specific action that triggered the XP
 * @param {Object} metadata - Optional extra data (e.g., { habitId: "..." })
 * @returns {Object} - Result containing new stats and level-up status
 */
export const awardXP = async (
    userId,
    xpAmount,
    reason = "General XP",
    metadata = {},
) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found for XP reward");
        }

        // Calculate old level BEFORE adding new XP
        const oldLevelInfo = calculateLevel(user.xp || 0);

        // Add xpAmount to user.xp
        user.xp = (user.xp || 0) + xpAmount;

        // Calculate new level
        const newLevelInfo = calculateLevel(user.xp);

        // Check if level increased
        const leveledUp = newLevelInfo.level > oldLevelInfo.level;
        let coinsAwarded = 0;

        if (leveledUp) {
            // Loop in case they earned a massive XP boost and skipped multiple levels at once
            for (let i = oldLevelInfo.level + 1; i <= newLevelInfo.level; i++) {
                coinsAwarded += i * 50;
            }

            // Add coins to user wallet
            user.coins = (user.coins || 0) + coinsAwarded;
        }

        // Save user
        await user.save();

        // 2. CREATE THE XP LOG ENTRY
        await XPLog.create({
            user: userId,
            amount: xpAmount,
            reason: reason,
            metadata: metadata,
        });

        // Return the updated gamification state
        return {
            newXp: user.xp,
            newLevel: newLevelInfo.level,
            leveledUp,
            coinsAwarded,
            progressPercentage: newLevelInfo.progressPercentage,
        };
    } catch (error) {
        console.error("Reward Engine Error:", error);
        throw error;
    }
};
