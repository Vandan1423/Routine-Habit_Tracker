import { Button, IconButton, Menu } from "../../components/ui";
import { cx } from "../../lib/cx";
import { dueWords, perWords } from "../../lib/expenseWords";
import styles from "./ExpensesPage.module.css";

/**
 * One subscription: its name, when it next falls due, and what it costs each time.
 * One that is due now offers "Mark as paid" on the row itself; the rest keep it in the menu.
 *
 * subscription: from buildExpenseMonth (lib/expenses.js)
 * onPay(subscription): called with the subscription as the model holds it
 * onEdit, onDelete, onRun(source, running): called with it as the API sent it
 */
const SubscriptionRow = ({ subscription, currency, onPay, onEdit, onRun, onDelete }) => {
    const { name, state, active, source, pending } = subscription;
    // One still on its way to the server is shown as it will be, with nothing on it to press yet
    const wanted = !pending && (state === "late" || state === "today");

    return (
        <li className={styles.frame}>
            <div className={cx(styles.row, !active && styles.paused)}>
                <div className={styles.main}>
                    {pending ? (
                        <span className={styles.name}>{name}</span>
                    ) : (
                        <button
                            type="button"
                            className={styles.name}
                            aria-label={`${name}, ${perWords(subscription.amount, subscription.frequency, currency)}, ${dueWords(subscription)}. Edit.`}
                            onClick={() => onEdit(source)}
                        >
                            {name}
                        </button>
                    )}
                    <span className={cx(styles.meta, state === "late" && styles.late)}>{dueWords(subscription)}</span>
                </div>
                {wanted && (
                    <Button size="sm" className={styles.pay} onClick={() => onPay(subscription)}>
                        Mark as paid
                    </Button>
                )}
                {!pending && (
                    <span className={styles.menu}>
                        <Menu align="end" trigger={<IconButton icon="more" size="sm" label={`Options for ${name}`} />}>
                            {active && (
                                <Menu.Item icon="check" onSelect={() => onPay(subscription)}>
                                    Mark as paid
                                </Menu.Item>
                            )}
                            <Menu.Item icon="edit" onSelect={() => onEdit(source)}>
                                Edit
                            </Menu.Item>
                            <Menu.Item icon={active ? "minus" : "repeat"} onSelect={() => onRun(source, !active)}>
                                {active ? "Pause" : "Resume"}
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(source)}>
                                Delete
                            </Menu.Item>
                        </Menu>
                    </span>
                )}
                <span className={styles.amount} aria-hidden="true">
                    {perWords(subscription.amount, subscription.frequency, currency)}
                </span>
            </div>
        </li>
    );
};

export default SubscriptionRow;
