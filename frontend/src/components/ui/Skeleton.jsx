import { cx } from "../../lib/cx";
import styles from "./Skeleton.module.css";

/**
 * A quiet placeholder for something that is loading. A loading screen is built from these in the exact
 * layout of the real one, so nothing moves when the content arrives.
 * variant: "block" (the default; give it a width and height), "text" (one line of text; give it a width
 *          such as "12ch", and it takes up the line height of wherever it is) or "circle"
 */
const Skeleton = ({ variant = "block", width, height, className, style }) => (
    <span
        className={cx(styles.skeleton, styles[variant], className)}
        style={{ width, height, ...style }}
        aria-hidden="true"
    />
);

export default Skeleton;
