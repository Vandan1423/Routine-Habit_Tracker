import { DayLayout } from "../../components/day";
import { Skeleton } from "../../components/ui";
import { cx } from "../../lib/cx";
import row from "../../components/todo/TodoRow.module.css";
import styles from "./TodoPage.module.css";

// The length of each placeholder line. Uneven on purpose, like real ones.
const LINES = ["22ch", "14ch", "27ch", "11ch", "18ch"];

/**
 * A list while it is on its way. Built from the real pieces' own styles, with a quiet bar wherever
 * there will be words, so that nothing moves when it arrives.
 */
const TodoSkeleton = () => (
    <DayLayout>
        <div aria-hidden="true">
            <div className={styles.header}>
                <div className={styles.text}>
                    <div className={cx(styles.eyebrow, styles.line)}>
                        <Skeleton variant="text" width="18ch" />
                    </div>
                    <div className={cx(styles.title, styles.line)}>
                        <Skeleton variant="text" width="4em" />
                    </div>
                </div>
            </div>
            <ul className={styles.rows}>
                {LINES.map((width) => (
                    <li key={width} className={row.row}>
                        <Skeleton width="var(--check)" height="var(--check)" />
                        <div className={row.main}>
                            <Skeleton variant="text" width={width} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    </DayLayout>
);

export default TodoSkeleton;
