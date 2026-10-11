import { Link, NavLink } from "react-router-dom";
import Brand from "./Brand";
import LevelIndicator from "./LevelIndicator";
import { DESTINATIONS, HOME_PATH } from "./navigation";
import UserMenu from "./UserMenu";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import Kbd from "../ui/Kbd";
import Tooltip from "../ui/Tooltip";
import useAuth from "../../hooks/useAuth";
import useCommands from "../../hooks/useCommands";
import useMediaQuery from "../../hooks/useMediaQuery";
import useStandaloneApp, { reloadApp } from "../../hooks/useStandaloneApp";
import { APP_NAME } from "../../lib/app";
import { cx } from "../../lib/cx";
import { KEYS } from "../../lib/shortcuts";
import styles from "./Sidebar.module.css";

// The screens in the groups they are shown in, each after a gap: what is done, what is looked back on, the rest
const GROUPS = [...new Set(DESTINATIONS.map((destination) => destination.group))].map((group) =>
    DESTINATIONS.filter((destination) => destination.group === group),
);

/**
 * The navigation beside every screen on anything wider than a phone: the name, the way into the command
 * menu, the screens, the level and whoever is signed in. On a tablet, or when it has been folded, it
 * narrows to a rail of icons, each named by a tooltip.
 *
 * folded: narrowed by choice. onFold: folds or unfolds it; without one there is no choice to offer.
 */
const Sidebar = ({ folded = false, onFold }) => {
    const isTablet = useMediaQuery("(max-width: 1099.98px)"); // bp: tablet (a phone has the tab bar instead)
    const isRail = isTablet || folded;
    const { levelInfo, levelLoaded } = useAuth();
    const { openMenu, preloadMenu } = useCommands();
    // Opened from the Home Screen there is no browser to reload with: the sidebar offers it
    const standalone = useStandaloneApp();

    const fold = onFold && (
        <Tooltip label={folded ? "Unfold sidebar" : "Fold sidebar"} shortcut={KEYS.sidebar} side={isRail ? "right" : "bottom"}>
            <IconButton
                icon="sidebar"
                label={folded ? "Unfold the sidebar" : "Fold the sidebar"}
                aria-expanded={!folded}
                size={isRail ? "lg" : "md"}
                className={styles.fold}
                onClick={onFold}
            />
        </Tooltip>
    );

    return (
        <aside className={cx(styles.side, isRail && styles.rail)}>
            <div className={styles.head}>
                <Link to={HOME_PATH} className={styles.brand} aria-label={`${APP_NAME}: go to Today`}>
                    <Brand markOnly={isRail} />
                </Link>
                {fold}
            </div>

            <Tooltip label="Jump to" shortcut={KEYS.menu} side="right" disabled={!isRail}>
                <button
                    type="button"
                    className={styles.jump}
                    aria-label={isRail ? "Jump to" : undefined}
                    aria-haspopup="dialog"
                    onClick={openMenu}
                    onPointerEnter={preloadMenu}
                    onFocus={preloadMenu}
                >
                    <Icon name="search" size={isRail ? 20 : 16} />
                    {!isRail && (
                        <>
                            <span className={styles.jumpLabel}>Jump to</span>
                            <Kbd keys={KEYS.menu} />
                        </>
                    )}
                </button>
            </Tooltip>

            <nav className={styles.nav} aria-label="Main">
                {GROUPS.map((group) => (
                    <ul key={group[0].id} className={styles.group}>
                        {group.map((destination) => (
                            <li key={destination.id}>
                                <Tooltip label={destination.label} side="right" disabled={!isRail}>
                                    <NavLink
                                        to={destination.path}
                                        className={styles.item}
                                        onPointerEnter={destination.preload}
                                        onFocus={destination.preload}
                                    >
                                        <Icon name={destination.icon} size={isRail ? 20 : 16} />
                                        <span className={isRail ? "visually-hidden" : undefined}>
                                            {destination.label}
                                        </span>
                                    </NavLink>
                                </Tooltip>
                            </li>
                        ))}
                    </ul>
                ))}
                {standalone && (
                    <ul className={styles.group}>
                        <li>
                            <Tooltip label="Refresh" side="right" disabled={!isRail}>
                                <button type="button" className={styles.item} onClick={reloadApp}>
                                    <Icon name="refresh" size={isRail ? 20 : 16} />
                                    <span className={isRail ? "visually-hidden" : undefined}>Refresh</span>
                                </button>
                            </Tooltip>
                        </li>
                    </ul>
                )}
            </nav>

            <LevelIndicator
                compact={isRail}
                loading={!levelLoaded}
                level={levelInfo.level}
                currentXp={levelInfo.currentXp}
                xpForNext={levelInfo.xpForNext}
            />
            <UserMenu compact={isRail} />
        </aside>
    );
};

export default Sidebar;
