import XPLog from '../models/XPLog.js';
import { changeBalance } from './xpBalance.js';
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
        // 1. Deduct XP in one step (see changeBalance) — but never go below 0
        // (Using Math.abs just in case a negative number is passed in accidentally)
        const penaltyAmount = Math.abs(xpPenalty);
        const changed = await changeBalance(userId, ({ xp, coins }) => ({
            xp: Math.max(0, xp - penaltyAmount),
            coins, // A penalty leaves coins alone
        }));
        if (!changed) {
            throw new Error("User not found for XP penalty");
        }

        // 2. Calculate exactly how much XP was actually lost
        // (e.g., if they had 5 XP and penalty was 20, they only lost 5)
        const actualXpLost = changed.before.xp - changed.after.xp;

        // 3. Recalculate level
        const oldLevelInfo = calculateLevel(changed.before.xp);
        const newLevelInfo = calculateLevel(changed.after.xp);

        // Track if this penalty caused them to drop a level
        const leveledDown = newLevelInfo.level < oldLevelInfo.level;

        // 4. Create an XPLog entry with a negative amount
        // Only log it if they actually had XP to lose
        if (actualXpLost > 0) {
            await XPLog.create({
                user: userId,
                amount: -actualXpLost,
                reason: reason,
                metadata: metadata
            });
        }

        // 5. Return stats
        return {
            newXp: changed.after.xp,
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