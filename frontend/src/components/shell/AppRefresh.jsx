import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import useMediaQuery from "../../hooks/useMediaQuery";
import styles from "./AppRefresh.module.css";

// Away this long, the app opened from the Home Screen starts afresh instead of showing what it held
const STALE_AFTER_MS = 5 * 60 * 1000;

const reload = () => window.location.reload();

/**
 * For the app opened from a phone's Home Screen, which has no browser around it: no reload button, and
 * no pull-down to reload. A button of its own, in the top corner, loads the app again from the server.
 * Coming back to it after a while does the same by itself, so it never opens on old information.
 * Draws nothing in a browser tab.
 */
const AppRefresh = () => {
    const standalone =
        useMediaQuery("(display-mode: standalone)") ||
        (typeof navigator !== "undefined" && navigator.standalone === true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!standalone) return undefined;
        let hiddenAt = null;

        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
            } else if (hiddenAt && Date.now() - hiddenAt >= STALE_AFTER_MS) {
                reload();
            }
        };
        // iOS can bring back a page frozen in memory: that copy is as old as when it was left
        const onPageShow = (event) => {
            if (event.persisted) reload();
        };

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pageshow", onPageShow);
        };
    }, [standalone]);

    if (!standalone) return null;

    return (
        <button
            type="button"
            className={styles.button}
            aria-label="Refresh"
            data-busy={busy ? "" : undefined}
            onClick={() => {
                setBusy(true);
                reload();
            }}
        >
            <Icon name="refresh" size={18} />
        </button>
    );
};

export default AppRefresh;
