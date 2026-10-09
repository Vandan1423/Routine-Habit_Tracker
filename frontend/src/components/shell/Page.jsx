import { Link } from "react-router-dom";
import Brand from "./Brand";
import { HOME_PATH } from "./navigation";
import { cx } from "../../lib/cx";
import styles from "./Page.module.css";

/**
 * The frame a screen is set in: its gutters, and the room the navigation needs.
 * Inside the shell it is the screen's root. `standalone` is for a screen shown with no navigation
 * around it (before sign-in, or when the shell itself cannot be shown): one short column under the name.
 */
const Page = ({ standalone = false, className, children }) => {
    if (standalone) {
        return (
            <div className={cx(styles.standalone, className)}>
                <div className={styles.column}>
                    <Link to={HOME_PATH} className={styles.home}>
                        <Brand />
                    </Link>
                    {children}
                </div>
            </div>
        );
    }

    return <div className={cx(styles.page, className)}>{children}</div>;
};

export default Page;
