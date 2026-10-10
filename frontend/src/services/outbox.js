import api, { PATIENT } from "./api";

/*
 * Where a change goes when it is already on screen by the time it is sent.
 *
 * Nobody is waiting on such a request, so three things can be done for it that a form's own request
 * does not get. A server that is waking up is waited for. A request that got no answer is sent again:
 * one that makes something carries a key (the Idempotency-Key header), and the server makes the thing
 * once however often it hears of it. And until it is answered the request is written down on this
 * device, so that one cut short by the tab closing is sent when the app next opens.
 */

const STORE = "nityakram.outbox";
const OWNER = "nityakram.authUser";
// What was left behind longer ago than this is let go: by then it may no longer be what is wanted
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
// How long to wait before sending again something that got no answer
const WAITS_MS = [2000, 6000];

// A key for one new thing, whichever way it turns out to be sent
export const newKey = () =>
    globalThis.crypto?.randomUUID?.() ?? `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

const owner = () => {
    try {
        const user = JSON.parse(window.localStorage.getItem(OWNER));
        return user?._id ?? user?.id ?? user?.email ?? null;
    } catch {
        return null;
    }
};

const read = () => {
    try {
        const entries = JSON.parse(window.localStorage.getItem(STORE));
        return Array.isArray(entries) ? entries : [];
    } catch {
        return [];
    }
};

// Storage can be full or switched off; the change is still sent, it is only not written down
const keep = (entries) => {
    try {
        if (entries.length > 0) window.localStorage.setItem(STORE, JSON.stringify(entries));
        else window.localStorage.removeItem(STORE);
    } catch {
        // nothing to do
    }
};

// No answer, or an answer from something in between that never reached the app's own server
const unanswered = (error) => !error?.response || [502, 503, 504].includes(error.response.status);

const request = ({ method, url, data, key }) =>
    api.request({ method, url, data, ...PATIENT, headers: key ? { "Idempotency-Key": key } : undefined });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The page is on its way out: whatever fails from here on failed because of that, and stays written down
let leaving = false;
// Changes that cannot be written down yet, because they wait for the id of something still being made
let held = 0;

if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
        leaving = true;
    });
    window.addEventListener("pageshow", () => {
        leaving = false;
    });
    // Those are the only ones a closing tab would lose, so that is when the browser is asked to check first
    window.addEventListener("beforeunload", (event) => {
        if (held > 0) event.preventDefault();
    });
}

/**
 * Sends a change that is already on screen. Resolves and rejects as the api's own request does.
 * @param {String} method - "post", "put" or "delete"
 * @param {Object} [options]
 * @param {String} [options.key] - for a request that makes something: from newKey, the same one each time it is sent
 * @param {Boolean} [options.again] - a request without a key that is safe to send twice all the same
 */
export const write = async (method, url, data, { key, again = false } = {}) => {
    const entry = { id: newKey(), owner: owner(), method, url, data, key, at: Date.now() };
    const repeatable = method === "put" || Boolean(key) || again;
    const forget = () => {
        if (!leaving) keep(read().filter((kept) => kept.id !== entry.id));
    };

    keep([...read(), entry]);

    for (let attempt = 0; ; attempt += 1) {
        try {
            const response = await request(entry);
            forget();
            return response;
        } catch (error) {
            if (!repeatable || !unanswered(error) || attempt >= WAITS_MS.length) {
                forget();
                throw error;
            }
            await wait(WAITS_MS[attempt]);
        }
    }
};

/**
 * Counts a change as not yet written down until `waiting` settles: it is queued behind something that
 * is still being made, and has no id to be sent with yet.
 */
export const hold = (waiting) => {
    const release = () => {
        held -= 1;
    };

    held += 1;
    waiting.then(release, release);
    return waiting;
};

const mine = (entry, account) => entry.owner === account && Date.now() - entry.at < KEEP_MS;

// Whether the last visit left anything of this account's unsent
export const hasLeftBehind = () => {
    const account = owner();
    return account !== null && read().some((entry) => mine(entry, account));
};

/**
 * Sends what the last visit left unsent, in the order it was made. What the server answers, whatever
 * the answer, is done with; what still gets no answer waits for the next visit.
 */
export const sendLeftBehind = async () => {
    const account = owner();
    const due = read().filter((entry) => mine(entry, account));
    const waiting = [];

    for (const entry of due) {
        try {
            await request(entry);
        } catch (error) {
            if (unanswered(error)) waiting.push(entry.id);
        }
    }

    // Read again: something may have been written down while these were being sent
    const done = new Set(due.map((entry) => entry.id).filter((id) => !waiting.includes(id)));
    keep(read().filter((entry) => !done.has(entry.id) && Date.now() - entry.at < KEEP_MS));
};
