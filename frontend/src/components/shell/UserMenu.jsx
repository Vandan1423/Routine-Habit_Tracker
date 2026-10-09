import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import { DESTINATIONS } from "./navigation";
import Icon from "../ui/Icon";
import Menu from "../ui/Menu";
import useAuth from "../../hooks/useAuth";
import useCommands from "../../hooks/useCommands";
import { cx } from "../../lib/cx";
import { displayNameOf } from "../../lib/person";
import { goKey, KEYS } from "../../lib/shortcuts";
import styles from "./UserMenu.module.css";

const SETTINGS = DESTINATIONS.find((destination) => destination.id === "settings");

/**
 * The signed-in person at the foot of the sidebar. Pressing it opens the few things that belong to the
 * account rather than to a screen: its settings, the list of shortcuts, and signing out.
 * compact: only the disc, for the narrow rail
 */
const UserMenu = ({ compact = false }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { openShortcuts } = useCommands();

    const name = displayNameOf(user);
    const email = user?.email && user.email !== name ? user.email : null;

    const trigger = (
        <button
            type="button"
            className={cx(styles.user, compact && styles.compact)}
            aria-label={`Account: ${name}`}
        >
            <Avatar user={user} />
            {!compact && (
                <>
                    <span className={styles.name}>{name}</span>
                    <Icon name="more" className={styles.dots} />
                </>
            )}
        </button>
    );

    return (
        <Menu
            trigger={trigger}
            side={compact ? "right" : "top"}
            align={compact ? "end" : "start"}
            className={styles.menu}
        >
            <div className={styles.who}>
                <span className={styles.whoName}>{name}</span>
                {email && <span className={styles.whoEmail}>{email}</span>}
            </div>
            <Menu.Separator />
            <Menu.Item
                icon={SETTINGS.icon}
                shortcut={goKey(SETTINGS)}
                onPointerEnter={SETTINGS.preload}
                onSelect={() => navigate(SETTINGS.path)}
            >
                Settings
            </Menu.Item>
            <Menu.Item icon="keyboard" shortcut={KEYS.help} onSelect={openShortcuts}>
                Keyboard shortcuts
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item icon="sign-out" onSelect={() => logout()}>
                Sign out
            </Menu.Item>
        </Menu>
    );
};

export default UserMenu;
