import { Fragment, useId } from "react";
import DayRow, { PastDayRow } from "./DayRow";
import Icon from "../ui/Icon";
import SectionHeader from "../ui/SectionHeader";
import useMoment from "../../hooks/useMoment";
import { cx } from "../../lib/cx";
import { minutesOf } from "../../lib/day";
import { formatTime, fromMinutes } from "../../lib/time";
import styles from "./DayBlock.module.css";

// The line drawn under the heading, and its letting go (--t-slow, then --t-base twice over), and a little more
const SEAL_MS = 900;

// Where the clock stands among the block's routines
const NowLine = ({ now }) => (
    <li className={styles.now} aria-hidden="true">
        {formatTime(fromMinutes(minutesOf(now)))}
    </li>
);

/**
 * One part of the day (Morning, Afternoon, Evening, Anytime): a small heading over its rows.
 * The part the clock is in is drawn in full ink and carries the "now" line.
 * When its last item is done and the server has taken the tick, the block is sealed: for a moment an ink line
 * is drawn under the heading, and "Complete" is written at its end. A block that loads already sealed
 * simply says so.
 *
 * block: from buildDay (lib/day.js)
 * next: the day's one item to turn to, if any ({ item, state, inMinutes })
 * now: the moment the day was built for
 * folded: its rows are put away, leaving the heading
 * onFold(block, folded): the heading was pressed. Without it the block cannot be folded.
 * onCheck, onStep: passed to each row
 * renderMenu(item): the menu for a row, if rows have one
 * past: the day is over. Its rows show how each thing stood and cannot be changed.
 * linkTo(item): where a row's name leads on a day that is over, if anywhere
 */
const DayBlock = ({
    block,
    next,
    now,
    folded = false,
    onFold,
    onCheck,
    onStep,
    renderMenu,
    past = false,
    linkTo,
}) => {
    const rowsId = useId();
    const sealing = useMoment(block.sealed, SEAL_MS);

    return (
        <section
            className={cx(styles.block, sealing && styles.sealing, folded && styles.folded)}
            aria-label={block.label}
        >
            <SectionHeader
                className={styles.head}
                title={
                    onFold ? (
                        <button
                            type="button"
                            className={styles.toggle}
                            aria-expanded={!folded}
                            aria-controls={rowsId}
                            onClick={() => onFold(block, !folded)}
                        >
                            {block.label}
                            <Icon name="chevron" size={14} className={styles.chevron} />
                        </button>
                    ) : (
                        block.label
                    )
                }
                current={block.current}
                meta={block.sealed ? null : `${block.done} of ${block.total}`}
                actions={
                    block.sealed && (
                        <span className={styles.complete}>
                            <Icon name="check" />
                            Complete
                        </span>
                    )
                }
            />
            {/* Folded, the rows are out of reach of the keyboard and of screen readers as well as out of sight */}
            <div className={styles.fold} inert={folded}>
                <ul id={rowsId} className={styles.rows}>
                    {block.items.map((item, index) => (
                        <Fragment key={item.row ?? item.key}>
                            {block.nowIndex === index && <NowLine now={now} />}
                            {past ? (
                                <PastDayRow item={item} to={linkTo?.(item)} />
                            ) : (
                                <DayRow
                                    item={item}
                                    next={next?.item.key === item.key ? next : null}
                                    onCheck={onCheck}
                                    onStep={onStep}
                                    menu={renderMenu?.(item)}
                                />
                            )}
                        </Fragment>
                    ))}
                    {block.nowIndex === block.items.length && <NowLine now={now} />}
                </ul>
            </div>
        </section>
    );
};

export default DayBlock;
