import { useEffect, useState } from "react";

/**
 * True for a short while after something becomes so: the moment a check is ticked, a block is finished.
 * It is for animations that mark a change and must not play when the screen simply loads in that state,
 * so it never starts out true.
 *
 * on: the condition being watched
 * duration: how long the moment lasts, in milliseconds
 */
const useMoment = (on, duration = 600) => {
    const [state, setState] = useState({ on, active: false });

    // The condition changed since the last render: turning true starts a moment, turning false ends any
    if (state.on !== on) {
        setState({ on, active: on });
    }

    useEffect(() => {
        if (!state.active) return undefined;

        const timer = setTimeout(
            () => setState((current) => (current.active ? { ...current, active: false } : current)),
            duration,
        );
        return () => clearTimeout(timer);
    }, [state.active, duration]);

    return state.active;
};

export default useMoment;
