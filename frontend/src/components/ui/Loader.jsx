import { cx } from "../../lib/cx";
import styles from "./Loader.module.css";

// The app's sign for "working on it": three bars filling in turn, the Day Strip in miniature.
// Give it a `label` when it stands alone; inside a control that already says it is busy, leave it out.
const Loader = ({ label, className }) => (
    <span
        className={cx(styles.loader, className)}
        role={label ? "status" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
    >
        <i />
        <i />
        <i />
    </span>
);

export default Loader;
