import { useEffect } from "react";
import useStandaloneApp, { reloadApp } from "../../hooks/useStandaloneApp";

// Away this long, the app opened from the Home Screen starts afresh instead of showing what it held
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * For the app opened from the Home Screen: coming back to it after a while, or iOS bringing back a copy it
 * froze in memory, loads it again, so it never opens on old information. The button that does the same by
 * hand sits with the navigation (TabBar on a phone, Sidebar wider). Draws nothing.
 */
const AppRefresh = () => {
    const standalone = useStandaloneApp();

    useEffect(() => {
        if (!standalone) return undefined;
        let hiddenAt = null;

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
            } else if (hiddenAt && Date.now() - hiddenAt >= STALE_AFTER_MS) {
                reloadApp();
            }
        };
        const onPageShow = (event) => {
            if (event.persisted) reloadApp();
        };

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pageshow", onPageShow);
        };
    }, [standalone]);

    return null;
};

export default AppRefresh;
