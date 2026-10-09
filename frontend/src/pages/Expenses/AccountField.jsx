import { SegmentedControl, Select } from "../../components/ui";
import styles from "./forms.module.css";

// More accounts than this and they are chosen from a list instead of side by side
const SIDE_BY_SIDE = 3;

/**
 * Which account: the few there are side by side, or a list once there are more.
 *
 * label: what the choice is ("From", "To", "Paid from")
 * accounts: from buildExpenseMonth. value, onChange(id): the one chosen.
 * without: the id of an account that cannot be chosen here (the one a transfer leaves)
 */
const AccountField = ({ label, accounts, value, onChange, without, error }) => {
    const options = accounts
        .filter((account) => account.id !== without)
        .map((account) => ({ value: account.id, label: account.name }));

    if (options.length > SIDE_BY_SIDE) {
        return <Select label={label} options={options} value={value} error={error} onChange={onChange} />;
    }

    return (
        <div className={styles.labelled}>
            <span className={styles.label}>{label}</span>
            <SegmentedControl
                label={label}
                options={options}
                value={value}
                onChange={onChange}
                className={styles.choice}
            />
        </div>
    );
};

export default AccountField;
