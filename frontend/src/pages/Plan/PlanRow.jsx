import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { Icon } from "../../components/ui";
import { cx } from "../../lib/cx";
import { detailWords, patternWords, pauseWords } from "../../lib/itemWords";
import { itemPath } from "./planPaths";
import styles from "./PlanRow.module.css";

const xpFormat = new Intl.NumberFormat();

/**
 * One thing in the plan: its name, when it falls, and what it is worth. Pressing it opens its own page.
 * It comes into the list, and leaves it, by its own height.
 *
 * item: from buildPlan (lib/plan.js). One that is `saving` is on its way to the server and has no page yet.
 *   One with a `pause` says so after when it falls.
 * today, firstDay: for saying when it falls
 * menu: what opens from the row's "more" button
 * handle: props for a handle that reorders it (see useReorder). Without them it cannot be dragged.
 * dragging: it is the row being dragged. style: where a drag has put it for now.
 */
const PlanRow = ({ item, today, firstDay, menu, handle, dragging = false, style }) => {
    const isPresent = useIsPresent();
    // Clipped while it grows in or shrinks away, so its words do not spill out of a row too short to hold them
    const [resizing, setResizing] = useState(false);

    const detail = detailWords(item);
    const pattern = patternWords(item, { today, firstDay });

    return (
        <m.li
            className={cx(styles.frame, (resizing || !isPresent) && styles.clipped)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onAnimationStart={() => setResizing(true)}
            onAnimationComplete={() => setResizing(false)}
        >
            <div
                className={cx(styles.row, dragging && styles.dragging)}
                style={style}
                data-reorder={handle ? item.id : undefined}
                data-dragging={dragging ? "" : undefined}
                data-item={item.key}
            >
                {handle && (
                    <button
                        type="button"
                        className={styles.handle}
                        aria-label={`Reorder ${item.title}. Use the arrow keys.`}
                        data-reorder-handle=""
                        {...handle}
                    >
                        <Icon name="grip" />
                    </button>
                )}
                <div className={styles.main}>
                    {item.saving ? (
                        <span className={styles.title}>{item.title}</span>
                    ) : (
                        <Link to={itemPath(item)} className={styles.title}>
                            {item.title}
                        </Link>
                    )}
                    <span className={styles.meta}>
                        {detail}
                        {detail && " · "}
                        {pattern}
                        {item.pause && (
                            <>
                                {" · "}
                                <span className={styles.paused}>{pauseWords(item.pause, today)}</span>
                            </>
                        )}
                    </span>
                </div>
                {menu && <span className={styles.menu}>{menu}</span>}
                <span className={styles.xp}>
                    {xpFormat.format(item.worth)}&nbsp;XP
                </span>
            </div>
        </m.li>
    );
};

export default PlanRow;
