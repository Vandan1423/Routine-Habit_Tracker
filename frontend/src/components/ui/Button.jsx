import Icon from "./Icon";
import Loader from "./Loader";
import { cx } from "../../lib/cx";
import styles from "./Button.module.css";

/**
 * The app's button.
 * variant: "primary" (one per view, the main action), "secondary" (the default), "ghost" (quiet, for toolbars and rows)
 *          or "danger" (removes something)
 * size: "sm", "md" or "lg"
 * icon: the name of an icon to lead with
 * trailing: anything to end with, usually a <Kbd>
 * loading: the action is under way. The button keeps its width and its focus, and ignores further clicks.
 * as: what it is underneath. A button unless given; pass a router `Link` (with its `to`) when pressing it goes somewhere.
 */
const Button = ({
    as: Component = "button",
    variant = "secondary",
    size = "md",
    icon,
    trailing,
    loading = false,
    fullWidth = false,
    type = "button",
    className,
    onClick,
    children,
    ...rest
}) => {
    const handleClick = (event) => {
        if (loading) {
            event.preventDefault();
            return;
        }
        onClick?.(event);
    };

    return (
        <Component
            type={Component === "button" ? type : undefined}
            className={cx(
                styles.button,
                styles[variant],
                styles[size],
                fullWidth && styles.fullWidth,
                className,
            )}
            aria-busy={loading || undefined}
            aria-disabled={loading || undefined}
            onClick={handleClick}
            {...rest}
        >
            {icon && <Icon name={icon} className={styles.part} />}
            <span className={styles.part}>{children}</span>
            {trailing && <span className={cx(styles.part, styles.trailing)}>{trailing}</span>}
            {loading && <Loader className={styles.loader} />}
        </Component>
    );
};

export default Button;
