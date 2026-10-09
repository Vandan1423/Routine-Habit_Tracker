import { cx } from "../../lib/cx";
import styles from "./State.module.css";

/**
 * What a screen or a section shows while there is nothing in it: what belongs here, and the way to add it.
 * The words are written for each place it is used. This only lays them out, left-aligned like everything else.
 *
 * title: a short, plain heading ("Your day starts here")
 * children: a sentence or two
 * actions: one primary button, and at most one more
 * segments: how many empty Day Strip segments are drawn above the title, the app's own sign for
 *           "nothing here yet". 0 leaves the mark out.
 * size: "md" for a whole screen, "sm" inside a section
 * as: the heading element ("h2" unless given)
 */
const EmptyState = ({
    title,
    actions,
    segments = 6,
    size = "md",
    as: Heading = "h2",
    className,
    children,
}) => (
    <div className={cx(styles.state, styles[size], className)}>
        {segments > 0 && (
            <span className={styles.strip} aria-hidden="true">
                {Array.from({ length: segments }, (_, index) => (
                    <i key={index} />
                ))}
            </span>
        )}
        <Heading className={styles.title}>{title}</Heading>
        {children && <p className={styles.text}>{children}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
    </div>
);

export default EmptyState;
