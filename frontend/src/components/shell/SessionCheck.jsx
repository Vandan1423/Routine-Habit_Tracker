import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { HOME_PATH, OLD_PATHS, destinationFor, isStandalonePath } from "./navigation";
import Page from "./Page";
import PageSkeleton from "./PageSkeleton";
import Shell from "./Shell";
import Waking from "./Waking";
import Loader from "../ui/Loader";
import useAuth from "../../hooks/useAuth";
import useElapsedSeconds from "../../hooks/useElapsedSeconds";
import { WAKING_AFTER, holdLaunch, launchOver, subscribeLaunch } from "../../lib/launch";
import { SignInPage } from "../../routes/pages";
import styles from "./SessionCheck.module.css";

/**
 * What is on screen while the app finds out whether the visitor is still signed in.
 * Usually that takes a fraction of a second; when the server has been asleep it takes about half a minute.
 *
 * When the app opens, the opening screen (Launch) covers this wait and stays up for as long as this is here,
 * so there is nothing to draw underneath it. A check after that (rare) is drawn here: someone who was signed in
 * sees the app's own frame with the screen as a skeleton, anyone else a quiet page, and a slow check explains
 * itself (see Waking).
 */
const SessionCheck = () => {
    const { isAuthenticated } = useAuth();
    const { pathname } = useLocation();
    const elapsed = useElapsedSeconds();
    const launching = !useSyncExternalStore(subscribeLaunch, launchOver);

    // Keeps the opening screen up until the check is over
    useLayoutEffect(() => holdLaunch(), []);

    const waking = elapsed >= WAKING_AFTER;
    // True when this browser holds a session from last time, which the check is about to confirm
    const inShell = isAuthenticated && !isStandalonePath(pathname);

    // Use the wait: fetch the screen that will be shown when the check ends
    useEffect(() => {
        if (!isAuthenticated) {
            SignInPage.preload();
            return;
        }

        const redirected = OLD_PATHS.find(([from]) => from === pathname)?.[1];
        const target = redirected ?? (pathname === "/" ? HOME_PATH : pathname);
        destinationFor(target)?.preload();
    }, [isAuthenticated, pathname]);

    if (launching) return null;

    if (inShell) {
        return (
            <Shell>
                {waking ? (
                    <Page>
                        <Waking elapsed={elapsed} />
                    </Page>
                ) : (
                    <PageSkeleton />
                )}
            </Shell>
        );
    }

    return (
        <Page standalone className={waking ? undefined : styles.quiet}>
            {waking ? <Waking elapsed={elapsed} /> : <Loader label="Loading" />}
        </Page>
    );
};

export default SessionCheck;
