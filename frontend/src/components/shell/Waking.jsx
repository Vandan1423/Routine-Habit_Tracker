import Button from "../ui/Button";
import { APP_NAME } from "../../lib/app";
import { cx } from "../../lib/cx";
import styles from "./Waking.module.css";

// The server takes about half a minute to wake. The strip counts that out, one segment at a time.
const SEGMENTS = 8;
const SECONDS_PER_SEGMENT = 4;
const SLOW_AFTER = 60;

/**
 * Shown when the first request of a visit is taking long, which nearly always means the server was asleep.
 * It says so plainly and shows roughly how far along the wait is.
 * elapsed: seconds since the request went out
 */
const Waking = ({ elapsed }) => {
    // The last segment is never filled by the clock: it stays "in progress" until the server answers
    const filled = Math.min(Math.floor(elapsed / SECONDS_PER_SEGMENT), SEGMENTS - 1);

    return (
        <div className={styles.waking} role="status">
            <span
                className={styles.strip}
                style={{ "--segment-time": `${SECONDS_PER_SEGMENT}s` }}
                aria-hidden="true"
            >
                {Array.from({ length: SEGMENTS }, (_, index) => (
                    <i
                        key={index}
                        className={cx(
                            index < filled && styles.done,
                            index === filled && styles.current,
                        )}
                    />
                ))}
            </span>
            <h1 className={styles.title}>Waking up</h1>
            <p className={styles.text}>
                The server rests when {APP_NAME} hasn’t been opened for a while. The first visit
                after that takes about half a minute.
            </p>
            {elapsed >= SLOW_AFTER && (
                <div className={styles.slow}>
                    <p className={styles.text}>
                        This is taking longer than usual. You can keep waiting, or start again.
                    </p>
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                </div>
            )}
        </div>
    );
};

export default Waking;
