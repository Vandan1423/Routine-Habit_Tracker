import User from "../models/User.js";

// How often a change is worked out again because another one got in first. Each time that happens another
// change has gone through, so this is only ever reached by an account being changed many times at one instant.
const MAX_ATTEMPTS = 10;

/**
 * Changes an account's XP and coins so that no other change made at the same instant is lost.
 * The new figures are worked out from the ones just read, and written only if the account still holds
 * those; if something else changed them in between, they are read and worked out again.
 * (Reading, adding and saving, as this was done before, let two completions ticked together pay for one.)
 * @param {String} userId - The database ID of the user
 * @param {Function} change - ({ xp, coins }) => ({ xp, coins }): the figures after, from the figures before
 * @returns {Object|null} - { before, after }, or null when there is no such user
 */
export const changeBalance = async (userId, change) => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Read as stored: an account from before one of these fields existed has no value there at all
        const stored = await User.findById(userId).select("xp coins").lean();
        if (!stored) return null;

        const before = { xp: stored.xp || 0, coins: stored.coins || 0 };
        const after = change(before);

        // { field: null } also matches a field that is missing
        const written = await User.updateOne(
            { _id: userId, xp: stored.xp ?? null, coins: stored.coins ?? null },
            { $set: { xp: after.xp, coins: after.coins } },
        );
        if (written.matchedCount === 1) return { before, after };
    }

    throw new Error("The account's XP kept changing while it was being updated");
};
