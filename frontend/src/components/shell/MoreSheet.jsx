import { NavLink } from "react-router-dom";
import LevelIndicator from "./LevelIndicator";
import { DESTINATIONS } from "./navigation";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Icon from "../ui/Icon";
import useAuth from "../../hooks/useAuth";
import useCommands from "../../hooks/useCommands";
import { displayNameOf } from "../../lib/person";
import styles from "./MoreSheet.module.css";

const MORE = DESTINATIONS.filter((destination) => !destination.primary);

/**
 * On a phone, what does not fit in the tab bar: the level, the way into the command menu (which a phone
 * has no key for), the screens without a tab of their own (Settings among them) and signing out.
 * It is headed by whoever is signed in.
 */
const MoreSheet = ({ open, onOpenChange }) => {
    const { user, logout, authLoading, levelInfo, levelLoaded } = useAuth();
    const { openMenu, preloadMenu } = useCommands();

    // The sheet goes first: the menu is a dialog of its own, and takes the screen once this one has left it
    const jump = () => {
        onOpenChange(false);
        openMenu();
    };

    const name = displayNameOf(user);
    const email = user?.email && user.email !== name ? user.email : undefined;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            presentation="sheet"
            title={name}
            description={email}
        >
            <div className={styles.sheet}>
                <LevelIndicator
                    flush
                    loading={!levelLoaded}
                    level={levelInfo.level}
                    currentXp={levelInfo.currentXp}
                    xpForNext={levelInfo.xpForNext}
                />

                <ul className={styles.links}>
                    <li>
                        <button
                            type="button"
                            className={styles.link}
                            aria-haspopup="dialog"
                            onPointerDown={preloadMenu}
                            onClick={jump}
                        >
                            <Icon name="search" size={20} className={styles.linkIcon} />
                            <span className={styles.linkLabel}>Jump to</span>
                            <Icon name="chevron-right" className={styles.chevron} />
                        </button>
                    </li>
                    {MORE.map((destination) => (
                        <li key={destination.id}>
                            <NavLink
                                to={destination.path}
                                className={styles.link}
                                onPointerDown={destination.preload}
                                onClick={() => onOpenChange(false)}
                            >
                                <Icon name={destination.icon} size={20} className={styles.linkIcon} />
                                <span className={styles.linkLabel}>{destination.label}</span>
                                <Icon name="chevron-right" className={styles.chevron} />
                            </NavLink>
                        </li>
                    ))}
                </ul>

                <Button fullWidth size="lg" icon="sign-out" loading={authLoading} onClick={() => logout()}>
                    Sign out
                </Button>
            </div>
        </Dialog>
    );
};

export default MoreSheet;
