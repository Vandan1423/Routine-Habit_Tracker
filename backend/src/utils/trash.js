// Trash: where a deleted thing waits before it is gone for good.
// Deleting stamps it with the moment it went in (deletedAt) and the moment it will be let go (purgeAt).
// The second is fixed there and then, so changing the setting later never erases anything early.

const DAY_MS = 24 * 60 * 60 * 1000;

// How long Trash may keep things, in days. An account picks one.
export const TRASH_DAYS = [1, 3, 7];
export const DEFAULT_TRASH_DAYS = 7;

/**
 * The two dates a thing gets as it goes into Trash.
 * @param {Object} user - needs trashDays
 */
export const trashStamp = (user, now = new Date()) => ({
    deletedAt: now,
    purgeAt: new Date(now.getTime() + (user?.trashDays || DEFAULT_TRASH_DAYS) * DAY_MS),
});

// What recovering it sets them back to
export const OUT_OF_TRASH = { deletedAt: null, purgeAt: null };

// Matches what is not in Trash. Also true of everything saved before Trash existed, which has neither date.
export const KEPT = { deletedAt: null };

// Matches what is in Trash
export const IN_TRASH = { deletedAt: { $ne: null } };
