import ErrorState from "../ui/ErrorState";
import styles from "./ScreenError.module.css";

// A screen's code is fetched when it is first opened. That fetch fails when the connection drops,
// and also when a new version has replaced the files this tab was started with.
const isLoadFailure = (error) =>
    /dynamically imported module|module script failed|Unable to preload CSS/i.test(
        String(error?.message),
    );

const reload = () => window.location.reload();

// Shown in place of a screen that threw while rendering, or whose code could not be fetched
const ScreenError = ({ error }) => (
    <div className={styles.error}>
        {isLoadFailure(error) ? (
            <ErrorState as="h1" title="This screen didn’t load" onRetry={reload} retryLabel="Reload">
                The connection dropped, or the app was updated while this tab was open. Reload to
                carry on. Nothing you saved has been lost.
            </ErrorState>
        ) : (
            <ErrorState
                as="h1"
                title="This screen ran into a problem"
                onRetry={reload}
                retryLabel="Reload"
            >
                Reloading usually clears it. Nothing you saved has been lost.
            </ErrorState>
        )}
        {import.meta.env.DEV && error && (
            <pre className={styles.detail}>{String(error.stack || error)}</pre>
        )}
    </div>
);

export default ScreenError;
