import User from '../models/User.js';
import XPLog from '../models/XPLog.js';
import { calculateLevel } from './xpCalculator.js';

/**
 * Applies an XP penalty to a user, ensuring XP never drops below 0.
 * @param {String} userId - The database ID of the user
 * @param {Number} xpPenalty - The amount of XP to deduct
 * @param {String} reason - The specific reason for the penalty
 * @param {Object} metadata - Optional extra data (e.g., { habitId: "..." })
 * @returns {Object} - Result containing new stats and penalty details
 */
export const applyPenalty = async (userId, xpPenalty, reason = "Missed Task", metadata = {}) => {
    try {
        // 1. Get current user
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found for XP penalty");
        }

        const oldXp = user.xp || 0;
        const oldLevelInfo = calculateLevel(oldXp);

        // 2. Deduct XP — but never go below 0
        // (Using Math.abs just in case a negative number is passed in accidentally)
        const penaltyAmount = Math.abs(xpPenalty);
        const newXp = Math.max(0, oldXp - penaltyAmount);

        // Calculate exactly how much XP was actually lost 
        // (e.g., if they had 5 XP and penalty was 20, they only lost 5)
        const actualXpLost = oldXp - newXp;

        // Update user XP
        user.xp = newXp;

        // 3. Recalculate level
        const newLevelInfo = calculateLevel(user.xp);
        
        // Track if this penalty caused them to drop a level
        const leveledDown = newLevelInfo.level < oldLevelInfo.level;

        // 4. Save user
        await user.save();

        // 5. Create an XPLog entry with a negative amount
        // Only log it if they actually had XP to lose
        if (actualXpLost > 0) {
            await XPLog.create({
                user: userId,
                amount: -actualXpLost,
                reason: reason,
                metadata: metadata
            });
        }

        // 6. Return stats
        return {
            newXp: user.xp,
            newLevel: newLevelInfo.level,
            xpLost: actualXpLost,
            leveledDown,
            progressPercentage: newLevelInfo.progressPercentage
        };
    } catch (error) {
        console.error("Penalty Engine Error:", error);
        throw error;
    }
};