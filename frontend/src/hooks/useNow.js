import { useEffect, useState } from "react";

const MINUTE = 60 * 1000;

/**
 * The current time, renewed as each minute begins and whenever the tab is looked at again.
 * For anything on screen that depends on the clock: the "now" line, "in 25 min", a deadline passing.
 */
const useNow = () => {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let timer;

        const tick = () => {
            setNow(new Date());
            // Wait for the next minute to start, not for sixty seconds from whenever this happened to run
            timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50);
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                clearTimeout(timer);
                tick();
            }
        };

        timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    return now;
};

export default useNow;
