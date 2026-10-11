import { lazy, Suspense, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DESTINATIONS, destinationFor } from "./navigation";
import Icon from "../ui/Icon";
import useAppearance from "../../hooks/useAppearance";
import useStandaloneApp, { reloadApp } from "../../hooks/useStandaloneApp";
import { cx } from "../../lib/cx";
import styles from "./TabBar.module.css";

const TABS = DESTINATIONS.filter((destination) => destination.primary);

// The sheet behind "More" is downloaded when a finger first comes down on the tab, not with the app
const loadMoreSheet = () => import("./MoreSheet");
const MoreSheet = lazy(loadMoreSheet);

// The phone's navigation: a tab for each main screen along the bottom edge, and "More" for the rest
const TabBar = () => {
    const { pathname } = useLocation();
    const { reducedMotion } = useAppearance();
    const [moreOpen, setMoreOpen] = useState(false);
    // Once it has been opened it stays, so it can be seen closing
    const [moreWanted, setMoreWanted] = useState(false);
    // Opened from the Home Screen there is no browser to reload with: the bar offers it
    const standalone = useStandaloneApp();
    const [reloading, setReloading] = useState(false);

    const current = destinationFor(pathname);
    const underMore = Boolean(current && !current.primary);

    // Pressing the tab you are already on goes back to the top of it
    const handlePress = (destination) => {
        if (destination === current && pathname === destination.path) {
            window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
        }
    };

    return (
        <>
            <nav className={styles.tabs} aria-label="Main">
                {TABS.map((destination) => (
                    <NavLink
                        key={destination.id}
                        to={destination.path}
                        className={styles.tab}
                        onPointerDown={destination.preload}
                        onFocus={destination.preload}
                        onClick={() => handlePress(destination)}
                    >
                        <Icon name={destination.icon} size={20} />
                        <span>{destination.label}</span>
                    </NavLink>
                ))}
                {standalone && (
                    <button
                        type="button"
                        className={cx(styles.tab, reloading && styles.reloading)}
                        onClick={() => {
                            setReloading(true);
                            reloadApp();
                        }}
                    >
                        <Icon name="refresh" size={20} />
                        <span>Refresh</span>
                    </button>
                )}
                <button
                    type="button"
                    className={cx(styles.tab, (underMore || moreOpen) && styles.current)}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    onPointerDown={loadMoreSheet}
                    onFocus={loadMoreSheet}
                    onClick={() => {
                        setMoreWanted(true);
                        setMoreOpen(true);
                    }}
                >
                    <Icon name="more" size={20} />
                    <span>More</span>
                </button>
            </nav>
            {moreWanted && (
                <Suspense fallback={null}>
                    <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
                </Suspense>
            )}
        </>
    );
};

export default TabBar;
