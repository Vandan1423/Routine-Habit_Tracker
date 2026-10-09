import AnimatedNumber from "../ui/AnimatedNumber";
import ProgressBar from "../ui/ProgressBar";
import Skeleton from "../ui/Skeleton";
import Tooltip from "../ui/Tooltip";
import { cx } from "../../lib/cx";
import styles from "./LevelIndicator.module.css";

const numberFormat = new Intl.NumberFormat();
const formatNumber = (value) => numberFormat.format(value);

/**
 * The level, and how far along it the XP has come. Neither number jumps when it changes.
 *
 * level, currentXp, xpForNext: currentXp counts from the start of this level, xpForNext is the level's whole length
 * loading: the numbers are not known yet
 * compact: just the level number over a short bar, for the narrow rail. The rest is in a tooltip.
 * flush: no rule above it and no padding, for when it sits inside something else
 */
const LevelIndicator = ({
    level,
    currentXp,
    xpForNext,
    loading = false,
    compact = false,
    flush = false,
    className,
}) => {
    const classes = cx(styles.level, compact && styles.compact, flush && styles.flush, className);

    if (loading) {
        return (
            <div className={classes} aria-hidden="true">
                <div className={styles.row}>
                    <Skeleton variant="text" width={compact ? "2ch" : "7ch"} />
                    {!compact && <Skeleton variant="text" width="10ch" />}
                </div>
                <ProgressBar className={styles.bar} />
            </div>
        );
    }

    const xp = `${formatNumber(currentXp)} / ${formatNumber(xpForNext)} XP`;

    const indicator = (
        // One labelled picture for screen readers; what is inside is the drawing of it
        <div className={classes} role="img" aria-label={`Level ${level}, ${xp}`}>
            <div className={styles.row}>
                <span className={styles.name}>
                    {!compact && "Level "}
                    <AnimatedNumber value={level} />
                </span>
                {!compact && (
                    <span className={styles.xp}>
                        <AnimatedNumber mode="count" value={currentXp} format={formatNumber} />
                        {" / "}
                        {formatNumber(xpForNext)}&nbsp;XP
                    </span>
                )}
            </div>
            <ProgressBar className={styles.bar} value={currentXp} max={xpForNext} />
        </div>
    );

    if (!compact) {
        return indicator;
    }

    return (
        <Tooltip label={`Level ${level} · ${xp}`} side="right">
            {indicator}
        </Tooltip>
    );
};

export default LevelIndicator;
