import styles from "./DayLayout.module.css";

/**
 * How a day is set on the page: one reading column, and on a wide screen a quiet aside beside it.
 * Where there is no room beside, the aside follows the column.
 */
const DayLayout = ({ aside, children }) => (
    <div className={styles.frame}>
        <div className={styles.layout}>
            <div className={styles.column}>{children}</div>
            {aside && <aside className={styles.aside}>{aside}</aside>}
        </div>
    </div>
);

export default DayLayout;
