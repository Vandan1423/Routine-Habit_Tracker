import { useEffect, useState } from "react";
import { hasLeftBehind, sendLeftBehind } from "../services/outbox";

// The screens are held back this long for it, and no longer: after that they show what the server has so far
const WAITS_MS = 8000;

/**
 * Sends whatever the last visit left unsent (see services/outbox.js) before the screens read anything,
 * so that what they read already has it. True once that is done, which is at once on nearly every visit.
 */
const useLeftBehind = () => {
    const [sending, setSending] = useState(hasLeftBehind);

    useEffect(() => {
        if (!sending) return undefined;

        const done = () => setSending(false);
        const timer = setTimeout(done, WAITS_MS);
        sendLeftBehind().then(done, done);

        return () => clearTimeout(timer);
    }, [sending]);

    return !sending;
};

export default useLeftBehind;
