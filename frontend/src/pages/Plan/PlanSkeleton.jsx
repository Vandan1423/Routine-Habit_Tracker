import { DayLayout } from "../../components/day";
import { SectionHeader, Skeleton } from "../../components/ui";
import { cx } from "../../lib/cx";
import row from "./PlanRow.module.css";
import styles from "./PlanPage.module.css";
import own from "./PlanSkeleton.module.css";

// The length of each placeholder name, by part of the day. Uneven on purpose, like real names.
const BLOCKS = [
    ["16ch", "9ch", "13ch", "7ch"],
    ["14ch", "10ch", "8ch"],
];

/**
 * The plan while it is on its way. Built from the real pieces' own styles, with a quiet bar wherever
 * there will be words, so that nothing moves when it arrives.
 */
const PlanSkeleton = () => (
    <DayLayout>
        <div aria-hidden="true">
            <div className={styles.header}>
                <div className={styles.text}>
                    <div className={cx(styles.eyebrow, own.line)}>
                        <Skeleton variant="text" width="22ch" />
                    </div>
                    <div className={cx(styles.title, own.line)}>
                        <Skeleton variant="text" width="3em" />
                    </div>
                </div>
            </div>
            {BLOCKS.map((names, index) => (
                <div key={index} className={styles.block}>
                    <SectionHeader
                        className={styles.head}
                        as="div"
                        title={<Skeleton variant="text" width="8ch" />}
                    />
                    <ul className={styles.rows}>
                        {names.map((width) => (
                            <li key={width} className={row.row}>
                                <div className={cx(row.main, own.grow)}>
                                    <Skeleton variant="text" width={width} />
                                </div>
                                <Skeleton variant="text" width="5ch" />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    </DayLayout>
);

export default PlanSkeleton;
