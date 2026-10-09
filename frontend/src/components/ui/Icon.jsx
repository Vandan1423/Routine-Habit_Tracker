import { ICONS } from "./icons";
import { cx } from "../../lib/cx";
import styles from "./Icon.module.css";

// Draws one icon from the app's set (see icons.jsx for the names).
// An icon is decoration by default. Give it a `label` only when it stands alone and has to be announced.
const Icon = ({ name, size = 16, label, className, ...rest }) => (
    <svg
        className={cx(styles.icon, className)}
        width={size}
        height={size}
        viewBox="0 0 20 20"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
        {...rest}
    >
        {ICONS[name]}
    </svg>
);

export default Icon;
