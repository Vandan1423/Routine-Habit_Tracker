import { SectionHeader, Skeleton } from "../../components/ui";
import { cx } from "../../lib/cx";
import styles from "./InsightsPage.module.css";

const WEEKS = ["9ch", "9ch", "6ch", "6ch", "6ch"];
const DAYS = Array.from({ length: 7 }, (_, index) => index);

/**
 * Insights while the days are on their way: the sentence and the weeks, built from the real pieces'
 * own styles with a quiet bar wherever there will be words, so that nothing moves when they arrive.
 */
const InsightsSkeleton = () => (
    <div aria-hidden="true">
        <div className={styles.summary}>
            <Skeleton variant="text" width="min(40ch, 92%)" />
        </div>
        <div className={styles.section}>
            <SectionHeader className={styles.head} as="div" title={<Skeleton variant="text" width="11ch" />} />
            <div className={cx(styles.weekRow, styles.weekdays)} />
            {WEEKS.map((width, index) => (
                <div key={index} className={styles.weekRow}>
                    <Skeleton variant="text" width={width} />
                    {DAYS.map((day) => (
                        <Skeleton key={day} className={styles.blank} />
                    ))}
                    <span />
                </div>
            ))}
        </div>
    </div>
);

export default InsightsSkeleton;
