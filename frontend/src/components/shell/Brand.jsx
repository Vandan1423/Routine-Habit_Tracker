import { APP_NAME } from "../../lib/app";
import { cx } from "../../lib/cx";
import { WORDMARK, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "../../lib/wordmark";
import styles from "./Brand.module.css";

// The mark: three Day Strip segments, the last one still to be filled
export const BrandMark = ({ className }) => (
    <span className={cx(styles.mark, className)} aria-hidden="true">
        <i />
        <i />
        <i />
    </span>
);

// The name as drawn letters (see lib/wordmark.js). Its headline starts at y = 260 and its stems end at y = 895:
// that span is what Brand.module.css sets to the height of the mark.
const Wordmark = () => (
    <svg
        className={styles.name}
        viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
        aria-hidden="true"
        focusable="false"
    >
        <path d={WORDMARK} />
    </svg>
);

/**
 * The mark and the name together. The name is a drawing; screen readers are given it as text.
 * markOnly: draws just the mark, as on the narrow rail
 */
const Brand = ({ markOnly = false, className }) => (
    <span className={cx(styles.brand, className)}>
        <BrandMark />
        {!markOnly && <Wordmark />}
        <span className="visually-hidden" lang="sa">
            {APP_NAME}
        </span>
    </span>
);

export default Brand;
