import DayLayout from "./DayLayout";
import Skeleton from "../ui/Skeleton";
import SectionHeader from "../ui/SectionHeader";
import { cx } from "../../lib/cx";
import block from "./DayBlock.module.css";
import header from "./DayHeader.module.css";
import progress from "./DayProgress.module.css";
import row from "./DayRow.module.css";
import strip from "./DayStrip.module.css";
import week from "./WeekAside.module.css";
import styles from "./DaySkeleton.module.css";

// The length of each placeholder title, by block. Uneven on purpose, like real names.
const BLOCKS = [
    ["17ch", "10ch", "8ch", "13ch"],
    ["15ch", "9ch", "12ch"],
];
const WEEK = Array.from({ length: 7 }, (_, index) => index);

const AsideSkeleton = () => (
    <>
        <section>
            <div className={cx(week.heading, styles.line)}>
                <Skeleton variant="text" width="9ch" />
            </div>
            <ul className={week.week}>
                {WEEK.map((day) => (
                    <li key={day} className={week.day}>
                        <Skeleton variant="text" width="3ch" />
                        <Skeleton className={styles.mini} />
                    </li>
                ))}
            </ul>
        </section>
        <section>
            <div className={cx(week.heading, styles.line)}>
                <Skeleton variant="text" width="6ch" />
            </div>
            <div className={cx(week.figure, styles.line)}>
                <Skeleton variant="text" width="7ch" />
            </div>
        </section>
    </>
);

// Everything under a day's heading: how it stands, then its parts and their rows
const DayBody = () => (
    <>
        <div className={progress.progress}>
            <div className={progress.top}>
                <div className={cx(progress.message, styles.grow)}>
                    <Skeleton variant="text" width="min(34ch, 80%)" />
                </div>
                <div className={progress.count}>
                    <Skeleton variant="text" width="5ch" />
                </div>
            </div>
            <div className={cx(strip.strip, progress.strip)}>
                {BLOCKS.map((titles, index) => (
                    <div key={index} className={strip.group} style={{ flexGrow: titles.length }}>
                        <div className={strip.segments}>
                            {titles.map((title) => (
                                <span key={title} className={strip.segment} />
                            ))}
                        </div>
                        <div className={strip.label}>
                            <Skeleton variant="text" width="9ch" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
        {BLOCKS.map((titles, index) => (
            <div key={index} className={block.block}>
                <SectionHeader
                    as="div"
                    className={block.head}
                    title={<Skeleton variant="text" width="8ch" />}
                />
                <div className={block.fold}>
                    <ul className={block.rows}>
                        {titles.map((title) => (
                            <li key={title} className={row.row}>
                                <Skeleton className={styles.check} />
                                <div className={row.main}>
                                    <div className={row.title}>
                                        <Skeleton variant="text" width={title} />
                                    </div>
                                </div>
                                <div className={row.xp}>
                                    <Skeleton variant="text" width="3ch" className={styles.end} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        ))}
    </>
);

// The same, for a screen that has its own heading already (a day in History)
export const DayBodySkeleton = () => (
    <div aria-hidden="true">
        <DayBody />
    </div>
);

/**
 * A day that is still on its way. Built from the real pieces' own styles, with a quiet bar wherever
 * there will be words, so that nothing moves when the day arrives.
 */
const DaySkeleton = () => (
    <DayLayout aside={<AsideSkeleton />}>
        <div aria-hidden="true">
            <div className={header.header}>
                <div className={header.text}>
                    <div className={cx(header.eyebrow, styles.line)}>
                        <Skeleton variant="text" width="12ch" />
                    </div>
                    <div className={cx(header.title, styles.line)}>
                        <Skeleton variant="text" width="min(9em, 70%)" />
                    </div>
                </div>
            </div>
            <DayBody />
        </div>
    </DayLayout>
);

export default DaySkeleton;
