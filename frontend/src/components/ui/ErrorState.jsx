import { useState } from "react";
import Button from "./Button";
import { cx } from "../../lib/cx";
import styles from "./State.module.css";

/**
 * Shown in place of something that could not be loaded. It says what happened in plain words
 * and offers the way forward; no alarm colours.
 *
 * title: what is missing ("Today didn’t load")
 * children: a line of detail. Without one, a line about the connection is used.
 * onRetry: runs when "Try again" is pressed. If it returns a promise, the button shows it working.
 * retryLabel: "Try again" unless given
 * size: "md" for a whole screen, "sm" inside a section
 */
const ErrorState = ({
    title = "This didn’t load",
    onRetry,
    retryLabel = "Try again",
    size = "md",
    as: Heading = "h2",
    className,
    children = "Check your connection and try again. Nothing you did has been lost.",
}) => {
    const [retrying, setRetrying] = useState(false);

    const retry = async () => {
        setRetrying(true);
        try {
            await onRetry();
        } catch {
            // Still failing: this stays on screen, which says so
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className={cx(styles.state, styles[size], className)} role="alert">
            <Heading className={styles.title}>{title}</Heading>
            <p className={styles.text}>{children}</p>
            {onRetry && (
                <div className={styles.actions}>
                    <Button loading={retrying} onClick={retry}>
                        {retryLabel}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ErrorState;
