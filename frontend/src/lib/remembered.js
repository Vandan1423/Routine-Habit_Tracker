// Small things this browser remembers between visits (a recap put away, a block folded), kept in localStorage
// as JSON under names of the app's own. Storage that is full, blocked or holds something unreadable
// is treated as nothing remembered.

const PREFIX = "nitya.";

export const readRemembered = (name, fallback = null) => {
    try {
        const stored = window.localStorage.getItem(PREFIX + name);
        return stored === null ? fallback : JSON.parse(stored);
    } catch {
        return fallback;
    }
};

export const remember = (name, value) => {
    try {
        window.localStorage.setItem(PREFIX + name, JSON.stringify(value));
    } catch {
        // Not remembered this time; nothing depends on it
    }
};

export const forget = (name) => {
    try {
        window.localStorage.removeItem(PREFIX + name);
    } catch {
        // Nothing to do: it was not readable either
    }
};

/**
 * Something this browser kept under an earlier name is moved to the name it has now, once.
 * key and oldKey are the full names, as they stand in storage.
 */
export const adoptStored = (key, oldKey) => {
    try {
        const old = window.localStorage.getItem(oldKey);
        if (old === null) return;

        if (window.localStorage.getItem(key) === null) {
            window.localStorage.setItem(key, old);
        }
        window.localStorage.removeItem(oldKey);
    } catch {
        // Storage is blocked: there is nothing to move
    }
};
