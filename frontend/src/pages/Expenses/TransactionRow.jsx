import { useState } from "react";
import { useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { IconButton, Menu } from "../../components/ui";
import { cx } from "../../lib/cx";
import { entryMeta, entrySpoken, entryTitle } from "../../lib/expenseWords";
import { formatMoney, signedMoney } from "../../lib/money";
import { KEYS } from "../../lib/shortcuts";
import styles from "./ExpensesPage.module.css";

/**
 * One line of the ledger: what it was, what it went on, and the amount. Pressing it opens it to be changed.
 * It comes into the list, and leaves it, by its own height. One that is still on its way to the server
 * (entry.pending) is shown as it will be, and cannot be opened or deleted until the server has it.
 *
 * entry: from buildExpenseMonth (lib/expenses.js)
 * onEdit(transaction), onDelete(transaction): called with the transaction as the API sent it
 */
const TransactionRow = ({ entry, currency, onEdit, onDelete }) => {
    const isPresent = useIsPresent();
    // Clipped while it grows in or shrinks away, so its words do not spill out of a row too short to hold them
    const [resizing, setResizing] = useState(false);

    const title = entryTitle(entry);
    const meta = entryMeta(entry);

    return (
        <m.li
            className={cx(styles.frame, (resizing || !isPresent) && styles.clipped)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onAnimationStart={() => setResizing(true)}
            onAnimationComplete={() => setResizing(false)}
        >
            <div className={styles.row} data-item={entry.id}>
                <div className={styles.main}>
                    {entry.pending ? (
                        <span className={styles.name}>
                            <span className="visually-hidden">{entrySpoken(entry, currency)}. Saving.</span>
                            <span aria-hidden="true">{title}</span>
                        </span>
                    ) : (
                        <button
                            type="button"
                            className={styles.name}
                            aria-label={`${entrySpoken(entry, currency)}. Edit.`}
                            data-edit=""
                            onClick={() => onEdit(entry.source)}
                        >
                            {title}
                        </button>
                    )}
                    {meta && <span className={styles.meta}>{meta}</span>}
                </div>
                {!entry.pending && (
                    <span className={styles.menu}>
                        <Menu align="end" trigger={<IconButton icon="more" size="sm" label={`Options for ${title}`} />}>
                            <Menu.Item icon="edit" shortcut={KEYS.edit} onSelect={() => onEdit(entry.source)}>
                                Edit
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item
                                icon="trash"
                                tone="danger"
                                shortcut={KEYS.remove}
                                onSelect={() => onDelete(entry.source)}
                            >
                                Delete
                            </Menu.Item>
                        </Menu>
                    </span>
                )}
                <span className={cx(styles.amount, styles[entry.type])} aria-hidden="true">
                    {entry.type === "income" ? signedMoney(entry.amount, currency) : formatMoney(entry.amount, currency)}
                </span>
            </div>
        </m.li>
    );
};

export default TransactionRow;
