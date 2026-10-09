import { useId, useRef, useState } from "react";
import FormFailure from "./FormFailure";
import { Button, Dialog, Input } from "../../components/ui";
import { failureWords } from "../../lib/expenseWords";
import { currencySign, MOST_MONEY, readMoney, writeMoney } from "../../lib/money";
import styles from "./forms.module.css";

/**
 * Sets what each account holds right now. The figure typed becomes the account's balance as it stands;
 * everything logged before is kept, and everything logged after adds to it or takes from it.
 *
 * open: whether it is showing. accounts, currency: from buildExpenseMonth.
 * onSave(balances): saves [{ account, wanted }] for the accounts that changed; rejects if one could not be saved
 * onClose(): it wants to close
 */
const BalancesDialog = ({ open, accounts, currency, onSave, onClose }) => {
    const formId = useId();
    const formRef = useRef(null);

    const [seen, setSeen] = useState(false);
    const [typed, setTyped] = useState({});
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [saving, setSaving] = useState(false);

    // Opened afresh: each field holds what its account holds
    if (open !== seen) {
        setSeen(open);
        if (open) {
            setTyped(Object.fromEntries(accounts.map((account) => [account.id, writeMoney(account.balance)])));
            setErrors({});
            setFailure("");
            setSaving(false);
        }
    }

    const close = () => {
        if (!saving) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;

        const found = {};
        const balances = [];
        for (const account of accounts) {
            const wanted = readMoney(typed[account.id]);

            if (!Number.isFinite(wanted) || Math.abs(wanted) > MOST_MONEY) {
                found[account.id] = "Enter an amount.";
            } else if (wanted !== account.balance) {
                balances.push({ account, wanted });
            }
        }

        setErrors(found);
        if (Object.keys(found).length > 0) {
            requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid='true']")?.focus());
            return;
        }
        if (balances.length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        setFailure("");

        try {
            await onSave(balances);
            onClose();
        } catch (error) {
            setFailure(failureWords(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) close();
            }}
            size="sm"
            title="Balances"
            description="What each account holds right now."
            footer={
                <>
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        Save
                    </Button>
                </>
            }
        >
            <form id={formId} ref={formRef} className={styles.form} onSubmit={submit} noValidate>
                {accounts.map((account) => (
                    <Input
                        key={account.id}
                        label={account.name}
                        inputMode="decimal"
                        autoComplete="off"
                        leading={<span aria-hidden="true">{currencySign(currency)}</span>}
                        value={typed[account.id] ?? ""}
                        error={errors[account.id]}
                        onChange={(event) => {
                            setTyped((current) => ({ ...current, [account.id]: event.target.value }));
                            setErrors({});
                        }}
                    />
                ))}
                <p className={styles.note}>
                    Nothing already logged is changed. What you log from here on is added to these or taken
                    from them.
                </p>
                <FormFailure>{failure}</FormFailure>
            </form>
        </Dialog>
    );
};

export default BalancesDialog;
