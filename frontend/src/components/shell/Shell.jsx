import { Suspense, useLayoutEffect } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import AppRefresh from "./AppRefresh";
import ErrorBoundary from "./ErrorBoundary";
import { destinationFor } from "./navigation";
import PageSkeleton from "./PageSkeleton";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import useHotkeys from "../../hooks/useHotkeys";
import useMediaQuery from "../../hooks/useMediaQuery";
import useSidebar from "../../hooks/useSidebar";
import { cx } from "../../lib/cx";
import { KEYS } from "../../lib/shortcuts";
import styles from "./Shell.module.css";

/**
 * What surrounds every screen once someone is signed in: the sidebar (a rail on a tablet or when it has
 * been folded, a tab bar on a phone) and the area the screen itself is drawn in. The screen comes from the matching route,
 * or from `children` when the shell is shown without one (while the session is checked, or for a 404).
 * title: names the browser tab. Without one, the tab is named after the screen the address belongs to.
 */
const Shell = ({ title, children }) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const isDesktop = useMediaQuery("(min-width: 1100px)"); // bp: desktop
    const [collapsed, toggleSidebar] = useSidebar();
    // Only a desktop has the room to choose: a tablet is always a rail
    const folded = isDesktop && collapsed;
    const { pathname } = useLocation();
    const navigationType = useNavigationType();

    useDocumentTitle(title ?? destinationFor(pathname)?.label);

    // A new screen starts at its top. Going back or forward leaves the scroll position to the browser.
    useLayoutEffect(() => {
        if (navigationType !== "POP") {
            window.scrollTo(0, 0);
        }
    }, [pathname, navigationType]);

    useHotkeys({ [KEYS.sidebar]: toggleSidebar }, isDesktop);

    // The first part of the address: "plan" for /plan/habits
    const section = pathname.split("/")[1] ?? "";

    return (
        <div className={cx("app-shell", styles.shell, folded && styles.folded)}>
            <a href="#main" className={styles.skip}>
                Skip to content
            </a>
            {!isPhone && <Sidebar folded={folded} onFold={isDesktop ? toggleSidebar : undefined} />}
            <main id="main" className={styles.main} tabIndex={-1}>
                <ErrorBoundary resetKey={pathname}>
                    {/* Keyed, so moving to another screen shows its loading state at once
                        instead of holding the old screen until the new one has downloaded */}
                    <Suspense key={section} fallback={<PageSkeleton />}>
                        {children ?? <Outlet />}
                    </Suspense>
                </ErrorBoundary>
            </main>
            {isPhone && <TabBar />}
            <AppRefresh />
        </div>
    );
};

export default Shell;
