import useMoment from "../../hooks/useMoment";
import { cx } from "../../lib/cx";
import styles from "./DayStrip.module.css";

// As long as the spring runs (--t-spring), and a little over
const LAND_MS = 560;

// One item's place in the day. It fills as the item is done, in the same gesture as the tick.
const Segment = ({ item }) => {
    const landing = useMoment(item.done, LAND_MS);

    return (
        <span className={cx(styles.segment, landing && styles.landing, !item.done && styles.open)}>
            <span className={styles.fill} style={{ width: `${item.progress * 100}%` }} />
        </span>
    );
};

/**
 * The Day Strip: progress drawn as the day itself. One small segment for each thing due, in the order
 * the day runs and grouped by its parts. A segment fills when its item is done, and part of the way
 * while a counted habit is on its way there. When a part of the day is finished, and the server has
 * taken the last tick, its segments close up into one unbroken stroke.
 *
 * blocks: the day's parts, from buildDay (lib/day.js)
 * settled: the day is over, so what was left undone is drawn as missed rather than as still open
 * The same numbers are always written beside it, so screen readers pass over the drawing.
 */
const DayStrip = ({ blocks, settled = false, className }) => (
    <div className={cx(styles.strip, settled && styles.over, className)} aria-hidden="true">
        {blocks.map((block) => (
            <div
                key={block.id}
                className={cx(
                    styles.group,
                    block.sealed ? styles.sealed : block.current && styles.current,
                )}
                style={{ flexGrow: block.total }}
            >
                <div className={styles.segments}>
                    {block.items.map((item) => (
                        <Segment key={item.key} item={item} />
                    ))}
                </div>
                <div className={styles.label}>
                    <span>{block.label}</span>
                    <span className={styles.count}>
                        {block.done}/{block.total}
                    </span>
                </div>
            </div>
        ))}
    </div>
);

// Past this many, a day is drawn as two lengths (done, and not) instead of a segment each
const MOST_SEGMENTS = 16;

/**
 * A whole day as one short strip, for a week of days in a column.
 * total, done: how many things were due and how many got done
 * settled: the day is over, so what was left undone is drawn as missed rather than as still open
 * whole: always two lengths, for a strip too short to hold a mark for each thing
 * With nothing due (or nothing known, as for a day still to come) it is a single faint length.
 */
export const MiniStrip = ({ total = 0, done = 0, settled = false, whole = false, className }) => {
    if (total <= 0) {
        return (
            <span className={cx(styles.mini, styles.blank, className)} aria-hidden="true">
                <i />
            </span>
        );
    }

    const filled = Math.min(done, total);
    const marks =
        total <= MOST_SEGMENTS && !whole
            ? Array.from({ length: total }, (_, index) => ({ on: index < filled, grow: 1 }))
            : [
                  { on: true, grow: filled },
                  { on: false, grow: total - filled },
              ].filter((mark) => mark.grow > 0);

    return (
        <span className={cx(styles.mini, settled && styles.settled, className)} aria-hidden="true">
            {marks.map((mark, index) => (
                <i
                    key={index}
                    className={mark.on ? styles.on : undefined}
                    style={{ flexGrow: mark.grow }}
                />
            ))}
        </span>
    );
};

export default DayStrip;
