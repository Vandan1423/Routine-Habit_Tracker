// Small things this browser remembers between visits (a recap put away, a block folded), kept in localStorage
// as JSON under names of the app's own. Storage that is full, blocked or holds something unreadable
// is treated as nothing remembered.

const PREFIX = "nityakram.";

// The names the app had before, newest first: what was kept under them is still this browser's
const EARLIER_PREFIXES = ["nitya.", "life-management."];

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
 * Everything this browser kept under one of the app's earlier names (a session, the theme, a folded block)
 * is moved to the name it has now, once. Whoever reads storage as the app loads calls this first.
 */
export const adoptEarlierNames = () => {
    try {
        const storage = window.localStorage;
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));

        for (const prefix of EARLIER_PREFIXES) {
            for (const oldKey of keys.filter((key) => key.startsWith(prefix))) {
                const key = PREFIX + oldKey.slice(prefix.length);

                if (storage.getItem(key) === null) {
                    storage.setItem(key, storage.getItem(oldKey));
                }
                storage.removeItem(oldKey);
            }
        }
    } catch {
        // Storage is blocked: there is nothing to move
    }
};
