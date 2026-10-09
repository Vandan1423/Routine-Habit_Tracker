import { useEffect, useState } from "react";

// A request still unanswered after this long is almost certainly waiting for the server to wake
const SLOW_AFTER_MS = 4000;

/**
 * True once something has been under way for longer than a request normally takes, so the wait can explain itself.
 * pending: whether it is under way. Goes back to false the moment it is not.
 */
const useSlow = (pending, after = SLOW_AFTER_MS) => {
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        if (!pending) return undefined;

        const timer = setTimeout(() => setSlow(true), after);
        return () => {
            clearTimeout(timer);
            setSlow(false);
        };
    }, [pending, after]);

    return pending && slow;
};

export default useSlow;
