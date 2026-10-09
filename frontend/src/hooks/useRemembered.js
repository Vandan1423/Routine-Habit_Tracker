import { useCallback, useState } from "react";
import { readRemembered, remember } from "../lib/remembered";

/**
 * A value this browser keeps between visits (lib/remembered.js), as state: reading gives what was stored,
 * setting stores it. Give each account a name of its own, so one person's choices are not another's.
 *
 * name: what it is stored under; changing it switches to what is stored under the new name
 * fallback: the value when nothing is stored
 * Returns [value, update]. update takes the new value, or a function from the current one.
 */
const useRemembered = (name, fallback = null) => {
    const [state, setState] = useState(() => ({ name, value: readRemembered(name, fallback) }));

    // Another name (another account): start from what that one has stored
    let current = state;
    if (state.name !== name) {
        current = { name, value: readRemembered(name, fallback) };
        setState(current);
    }

    const update = useCallback(
        (next) => {
            setState((held) => {
                if (held.name !== name) return held;

                const value = typeof next === "function" ? next(held.value) : next;
                remember(name, value);
                return { name, value };
            });
        },
        [name],
    );

    return [current.value, update];
};

export default useRemembered;
