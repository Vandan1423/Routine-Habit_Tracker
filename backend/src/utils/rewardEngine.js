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

/**
 * Takes back XP that was awarded earlier (e.g. a completion the user undid), along with the
 * level-up coins that XP earned, so that awarding and then revoking leaves the user where they started.
 * @param {String} userId - The database ID of the user
 * @param {Number} xpAmount - The amount of XP to take back
 * @param {String} reason - The specific action that triggered the reversal
 * @param {Object} metadata - Optional extra data (e.g., { routineId: "..." })
 * @returns {Object} - Result containing new stats and what was actually taken back
 */
export const revokeXP = async (
    userId,
    xpAmount,
    reason = "XP revoked",
    metadata = {},
) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found for XP reversal");
        }

        const oldLevelInfo = calculateLevel(user.xp || 0);

        // XP never drops below 0
        const xpRevoked = Math.min(user.xp || 0, Math.abs(xpAmount));
        user.xp = (user.xp || 0) - xpRevoked;

        const newLevelInfo = calculateLevel(user.xp);

        // Mirror of the level-up reward in awardXP: give back the coins of every level lost
        let coinsRevoked = 0;
        for (let i = newLevelInfo.level + 1; i <= oldLevelInfo.level; i++) {
            coinsRevoked += i * 50;
        }
        coinsRevoked = Math.min(user.coins || 0, coinsRevoked);
        user.coins = (user.coins || 0) - coinsRevoked;

        await user.save();

        if (xpRevoked > 0) {
            await XPLog.create({
                user: userId,
                amount: -xpRevoked,
                reason: reason,
                metadata: metadata,
            });
        }

        return {
            newXp: user.xp,
            newLevel: newLevelInfo.level,
            xpRevoked,
            coinsRevoked,
            progressPercentage: newLevelInfo.progressPercentage,
        };
    } catch (error) {
        console.error("Reward Engine Error:", error);
        throw error;
    }
};
