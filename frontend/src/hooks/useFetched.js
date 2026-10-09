import { useCallback, useEffect, useRef, useState } from "react";

// What has been read so far this session, by key. Days that have ended do not change, so showing the
// last answer while a fresh one is on its way is nearly always showing the right thing.
const kept = new Map();

// Signing out empties it: what one account read is not left in memory for the next
export const clearFetched = () => kept.clear();

/**
 * Something read from the API and kept for the session: coming back to a screen shows what it showed
 * before, at once, and the fresh answer replaces it quietly.
 *
 * key: names what is being read, and whose it is ("days:<user>:2026-10"). null reads nothing.
 * read: () => a promise of it. Called again whenever the key changes.
 * Returns { data, status, retry, update }: status is "loading" until there is something to show, then "ready";
 * "error" only when there is nothing to show and the read failed. A refresh that fails keeps what was there.
 * update(change): puts change(data) in place of what is held, for showing a change before the server has
 * answered. Follow it with retry(), which reads what is really there.
 */
const useFetched = (key, read) => {
    const [state, setState] = useState({ key, data: kept.get(key), failed: false });
    const [attempt, setAttempt] = useState(0);
    const reader = useRef(read);

    useEffect(() => {
        reader.current = read;
    });

    useEffect(() => {
        if (key === null) return undefined;
        let current = true;

        reader
            .current()
            .then((data) => {
                kept.set(key, data);
                if (current) setState({ key, data, failed: false });
            })
            .catch(() => {
                if (current) setState({ key, data: kept.get(key), failed: true });
            });

        return () => {
            current = false;
        };
    }, [key, attempt]);

    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    const update = useCallback(
        (change) => {
            if (!kept.has(key)) return;

            const data = change(kept.get(key));
            kept.set(key, data);
            setState({ key, data, failed: false });
        },
        [key],
    );

    // Asked for something else since the last answer: what is kept for that, and nothing more yet
    const shown = state.key === key ? state : { data: kept.get(key), failed: false };
    const status = shown.data !== undefined ? "ready" : shown.failed ? "error" : "loading";

    return { data: shown.data, status, retry, update };
};

export default useFetched;
