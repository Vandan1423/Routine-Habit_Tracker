import { Link } from "react-router-dom";
import SampleDay from "./SampleDay";
import Brand from "../../components/shell/Brand";
import { HOME_PATH } from "../../components/shell/navigation";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import styles from "./AuthLayout.module.css";

/**
 * The frame of every page a visitor sees before signing in: one short column under the name, and beside
 * it, on a screen with the room, what a day in the app looks like. The column sits in the same place on
 * every one of these pages, so moving between them changes only what is in it.
 *
 * title: the page's heading, and the name of the browser tab
 * lead: a sentence under it. An element takes the sentence's place (a notice, for one).
 * foot: the last line of the column, usually the way to the neighbouring page
 */
const AuthLayout = ({ title, lead, foot, children }) => {
    useDocumentTitle(title);

    return (
        <div className={styles.frame}>
            <main className={styles.side}>
                <div className={styles.column}>
                    <Link to={HOME_PATH} className={styles.home}>
                        <Brand />
                    </Link>
                    <div className={styles.body}>
                        <h1 className={styles.title}>{title}</h1>
                        {typeof lead === "string" ? <p className={styles.lead}>{lead}</p> : lead}
                        {children}
                    </div>
                    <p className={styles.foot}>
                        {foot}
                        <Link to="/privacy" className={styles.privacy}>
                            Privacy
                        </Link>
                    </p>
                </div>
            </main>
            {/* A picture of the product, not part of the page: out of reach of the keyboard and of screen readers */}
            <aside className={styles.sample} aria-hidden="true" inert>
                <div className={styles.about}>
                    <p className={styles.claim}>Your day, as one list.</p>
                    <p className={styles.claimText}>
                        Routines at their hours, habits through the day. What you finish earns XP;
                        what is left when the day closes costs some back.
                    </p>
                </div>
                <SampleDay />
            </aside>
        </div>
    );
};

// A line that says something happened, or is happening, set where the lead would be
export const Notice = ({ children }) => (
    <p className={styles.notice} role="status">
        {children}
    </p>
);

// What went wrong with the form as a whole, under its fields
export const FormError = ({ children }) =>
    children ? (
        <p className={styles.formError} role="alert">
            {children}
        </p>
    ) : null;

// Said under the button while a request waits on a server that was asleep
export const SlowNote = ({ children }) => (
    <p className={styles.slow} role="status">
        {children}
    </p>
);

export default AuthLayout;
