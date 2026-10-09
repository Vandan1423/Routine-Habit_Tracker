import { useEffect, useRef } from "react";
import { bindHotkeys } from "../lib/hotkeys";

/**
 * Keyboard shortcuts for as long as the caller is on screen (see lib/hotkeys.js for how one is written):
 *   useHotkeys({ [KEYS.edit]: () => edit(current) });
 * The handlers may change on every render; the keys themselves are bound once.
 * enabled: false lets go of them, for a screen that is still loading
 */
const useHotkeys = (bindings, enabled = true) => {
    const latest = useRef(bindings);
    useEffect(() => {
        latest.current = bindings;
    });

    const names = Object.keys(bindings).join("\n");

    useEffect(() => {
        if (!enabled || !names) return undefined;

        return bindHotkeys(
            Object.fromEntries(
                names.split("\n").map((name) => [name, (event) => latest.current[name]?.(event)]),
            ),
        );
    }, [names, enabled]);
};

export default useHotkeys;
