import { APP_NAME } from "../../lib/app";
import { cx } from "../../lib/cx";
import styles from "./Brand.module.css";

// The mark: three Day Strip segments, the last one still to be filled
export const BrandMark = ({ className }) => (
    <span className={cx(styles.mark, className)} aria-hidden="true">
        <i />
        <i />
        <i />
    </span>
);

/**
 * The mark and the name together.
 * markOnly: draws just the mark and keeps the name for screen readers, as on the narrow rail
 */
const Brand = ({ markOnly = false, className }) => (
    <span className={cx(styles.brand, className)}>
        <BrandMark />
        <span className={markOnly ? "visually-hidden" : styles.name}>{APP_NAME}</span>
    </span>
);

export default Brand;
