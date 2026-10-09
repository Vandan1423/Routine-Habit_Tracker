import styles from "./DayHeader.module.css";

/**
 * The head of a day: a quiet line above, the date as the title, and one action at the far end.
 * The date is the only thing in the app set in the serif.
 */
const DayHeader = ({ eyebrow, title, action }) => (
    <header className={styles.header}>
        <div className={styles.text}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
        </div>
        {action}
    </header>
);

export default DayHeader;
