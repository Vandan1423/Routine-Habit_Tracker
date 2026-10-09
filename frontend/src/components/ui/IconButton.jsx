import Icon from "./Icon";
import { cx } from "../../lib/cx";
import styles from "./IconButton.module.css";

/**
 * A button that shows only an icon. `label` says what it does, for screen readers.
 * variant: "ghost" (the default) or "secondary" (with a border, when it stands alone)
 * size: "sm", "md" or "lg"
 */
const IconButton = ({
    icon,
    label,
    variant = "ghost",
    size = "md",
    type = "button",
    className,
    ...rest
}) => (
    <button
        type={type}
        className={cx(styles.button, styles[variant], styles[size], className)}
        aria-label={label}
        {...rest}
    >
        <Icon name={icon} size={size === "lg" ? 20 : 16} />
    </button>
);

export default IconButton;
