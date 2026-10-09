import { useLocation } from "react-router-dom";
import { HOME_PATH, OLD_PATHS } from "./navigation";
import Page from "./Page";
import DaySkeleton from "../day/DaySkeleton";
import Skeleton from "../ui/Skeleton";
import { cx } from "../../lib/cx";
import styles from "./PageSkeleton.module.css";

// How long each placeholder line is, as a share of the column. Uneven on purpose, like real titles.
const ROWS = ["38%", "54%", "31%", "47%", "42%", "35%"];

// True for the address Today lives at, and for the ones that lead there
const leadsHome = (pathname) =>
    pathname === "/" ||
    pathname === HOME_PATH ||
    OLD_PATHS.some(([from, to]) => from === pathname && to === HOME_PATH);

/**
 * What the content area shows while a screen is on its way.
 * For Today it is the day itself in outline, exactly where the day will be (see DaySkeleton),
 * so the screen's own loading state can take over from it without anything moving.
 * For any other screen it is a heading and a short list.
 *
 * delayed: stays unseen for a moment, so a screen that arrives at once is not preceded by a flash of this
 * day: draw the day's outline whatever the address is
 */
const PageSkeleton = ({ delayed = true, day }) => {
    const { pathname } = useLocation();
    const asDay = day ?? leadsHome(pathname);

    return (
        <Page className={cx(styles.skeleton, delayed && styles.delayed)}>
            <p className="visually-hidden" role="status">
                Loading
            </p>
            {asDay ? (
                <DaySkeleton />
            ) : (
                <div className={styles.column} aria-hidden="true">
                    <Skeleton variant="text" width="11ch" className={styles.eyebrow} />
                    <Skeleton width="min(15rem, 70%)" className={styles.title} />
                    <ul className={styles.rows}>
                        {ROWS.map((width) => (
                            <li key={width} className={styles.row}>
                                <Skeleton className={styles.check} />
                                <Skeleton variant="text" width={width} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Page>
    );
};

export default PageSkeleton;
