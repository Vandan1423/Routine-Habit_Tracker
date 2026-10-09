import { Icon } from "../../components/ui";
import { cx } from "../../lib/cx";
import styles from "./forms.module.css";

// Why a form on this screen was not saved. Always in the page, so it is announced when it gets its words.
const FormFailure = ({ children }) => (
    <p className={cx(styles.failure, children && styles.failed)} role="alert">
        {children && (
            <>
                <Icon name="alert" />
                {children}
            </>
        )}
    </p>
);

export default FormFailure;
