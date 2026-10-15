import Button from "../ui/Button";
import WrittenName from "./WrittenName";
import { APP_NAME } from "../../lib/app";
import { cx } from "../../lib/cx";
import { WAKING_AFTER } from "../../lib/launch";
import styles from "./Waking.module.css";

// After this long, offer to start again
const SLOW_AFTER = 60;

/**
 * What is shown while the app waits for its server: the name being written (see WrittenName), and once the wait
 * has gone on long enough to need it, a word on why. A long wait nearly always means the server was asleep.
 * elapsed: seconds since the wait began
 * answered, onWritten: the wait is over, and what to do once the name is whole (see WrittenName)
 * centred: the name holds the centre of the screen, where index.html first drew it, and the words hang below
 */
const Waking = ({ elapsed, answered = false, onWritten, centred = false }) => (
    <div className={cx(styles.waking, centred && styles.centred)} role="status">
        <span className="visually-hidden">
            Opening <span lang="sa">{APP_NAME}</span>
        </span>
        <WrittenName answered={answered} headStart={elapsed} onWritten={onWritten} />
        {elapsed >= WAKING_AFTER && !answered && (
            <div className={styles.words}>
                <p>
                    The server rests when {APP_NAME} hasn’t been opened for a while. Waking it takes
                    about half a minute.
                </p>
                {elapsed >= SLOW_AFTER && (
                    <div className={styles.slow}>
                        <p>This is taking longer than usual. You can keep waiting, or start again.</p>
                        <Button onClick={() => window.location.reload()}>Reload</Button>
                    </div>
                )}
            </div>
        )}
    </div>
);

export default Waking;
