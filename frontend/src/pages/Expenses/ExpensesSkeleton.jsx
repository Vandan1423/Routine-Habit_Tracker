import { SectionHeader, Skeleton } from "../../components/ui";
import styles from "./ExpensesPage.module.css";

// How long each placeholder line is. Uneven on purpose, like real entries.
const ROWS = ["12ch", "17ch", "9ch", "14ch", "11ch"];

// A picture that is still on its way: a quiet block exactly as tall as the picture will be
export const ChartSkeleton = ({ height }) => (
    <div className={styles.chartWait} style={{ height }} aria-hidden="true">
        <Skeleton width="100%" height="100%" />
    </div>
);

/**
 * A month while it is on its way: the sentence, the six months and the ledger, built from the real pieces'
 * own styles with a quiet bar wherever there will be words, so that nothing moves when they arrive.
 */
const ExpensesSkeleton = ({ chartHeight }) => (
    <div aria-hidden="true">
        <div className={styles.summary}>
            <Skeleton variant="text" width="min(42ch, 92%)" />
        </div>
        <div className={styles.section}>
            <SectionHeader className={styles.head} as="div" title={<Skeleton variant="text" width="9ch" />} />
            <div className={styles.picture}>
                <ChartSkeleton height={chartHeight} />
            </div>
        </div>
        <div className={styles.section}>
            <SectionHeader className={styles.head} as="div" title={<Skeleton variant="text" width="11ch" />} />
            <div className={styles.ledgerHead}>
                <Skeleton variant="text" width="6ch" />
            </div>
            {ROWS.map((width) => (
                <div key={width} className={styles.row}>
                    <div className={styles.main}>
                        <Skeleton variant="text" width={width} />
                    </div>
                    <Skeleton variant="text" width="5ch" />
                </div>
            ))}
        </div>
    </div>
);

export default ExpensesSkeleton;
