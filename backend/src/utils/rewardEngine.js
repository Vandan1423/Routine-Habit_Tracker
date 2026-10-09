import XPLog from "../models/XPLog.js"; // 1. Import the new model
import { changeBalance } from "./xpBalance.js";
import { calculateLevel } from "./xpCalculator.js";

// What reaching each level from `from` up to `to` pays (or, on the way down, takes back)
const coinsBetween = (from, to) => {
    let coins = 0;
    for (let level = from + 1; level <= to; level++) {
        coins += level * 50;
    }
    return coins;
};

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
        // The XP and any level-up coins go on in one step (see changeBalance)
        const changed = await changeBalance(userId, ({ xp, coins }) => {
            const newXp = xp + xpAmount;

            return {
                xp: newXp,
                // Every level passed pays, in case a massive XP boost skipped several at once
                coins: coins + coinsBetween(calculateLevel(xp).level, calculateLevel(newXp).level),
            };
        });
        if (!changed) {
            throw new Error("User not found for XP reward");
        }

        const { before, after } = changed;
        const oldLevelInfo = calculateLevel(before.xp);
        const newLevelInfo = calculateLevel(after.xp);
        const leveledUp = newLevelInfo.level > oldLevelInfo.level;
        const coinsAwarded = after.coins - before.coins;

        // 2. CREATE THE XP LOG ENTRY
        await XPLog.create({
            user: userId,
            amount: xpAmount,
            reason: reason,
            metadata: metadata,
        });

        // Return the updated gamification state
        return {
            newXp: after.xp,
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
        const changed = await changeBalance(userId, ({ xp, coins }) => {
            // XP never drops below 0
            const newXp = xp - Math.min(xp, Math.abs(xpAmount));

            // Mirror of the level-up reward in awardXP: give back the coins of every level lost
            const coinsLost = coinsBetween(calculateLevel(newXp).level, calculateLevel(xp).level);

            return { xp: newXp, coins: coins - Math.min(coins, coinsLost) };
        });
        if (!changed) {
            throw new Error("User not found for XP reversal");
        }

        const { before, after } = changed;
        const xpRevoked = before.xp - after.xp;
        const coinsRevoked = before.coins - after.coins;
        const newLevelInfo = calculateLevel(after.xp);

        if (xpRevoked > 0) {
            await XPLog.create({
                user: userId,
                amount: -xpRevoked,
                reason: reason,
                metadata: metadata,
            });
        }

        return {
            newXp: after.xp,
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
