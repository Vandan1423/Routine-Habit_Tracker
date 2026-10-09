import { cx } from "../../lib/cx";
import styles from "./SectionHeader.module.css";

/**
 * The small heading over a group of rows: "Morning", "This week". A hairline under it does the separating.
 * title: the heading. meta: quieter text beside it, such as "3 of 4".
 * actions: what sits at the far end, usually one small ghost button
 * current: the one section that is "now" is drawn in full ink; the others are quieter
 * as: the heading element ("h2" unless given), chosen to fit the page's outline
 */
const SectionHeader = ({ title, meta, actions, current = false, as: Heading = "h2", className }) => (
    <div className={cx(styles.header, current && styles.current, className)}>
        <Heading className={styles.title}>{title}</Heading>
        {meta && <span className={styles.meta}>{meta}</span>}
        {actions && <div className={styles.actions}>{actions}</div>}
    </div>
);

export default SectionHeader;
