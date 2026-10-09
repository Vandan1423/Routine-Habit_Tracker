import { useId, useRef, useState } from "react";
import FormFailure from "./FormFailure";
import { Button, Dialog, Input, Select } from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import { validateLimit } from "../../lib/expenses";
import { categoryLabel, failureWords } from "../../lib/expenseWords";
import { currencySign, writeMoney } from "../../lib/money";
import styles from "./forms.module.css";

/**
 * Sets how much a category may take in a month, or changes or removes a limit that is set.
 *
 * request: what to open with, or null while closed: { limit? }, a limit from buildExpenseMonth to change
 * categories: the ones a new limit can be set for. currency: from buildExpenseMonth.
 * onSave(form, budget): saves it; rejects if it could not be saved
 * onRemove(budget): "Remove limit" was chosen. onClose(): it wants to close.
 */
const LimitDialog = ({ request, categories, currency, onSave, onRemove, onClose }) => {
    const formId = useId();
    const amountRef = useRef(null);

    // What it is showing stays in place while it closes
    const shown = useLastValue(request);
    const limit = shown?.limit ?? null;

    const [seen, setSeen] = useState(null);
    const [category, setCategory] = useState("");
    const [amount, setAmount] = useState("");
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [saving, setSaving] = useState(false);

    // Opened afresh: start from the limit, or from the first category without one
    if (request !== seen) {
        setSeen(request);

        if (request) {
            setCategory(request.limit?.category ?? categories[0] ?? "");
            setAmount(request.limit ? writeMoney(request.limit.limit) : "");
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

        const found = validateLimit({ category, amount });
        setErrors(found);
        if (Object.keys(found).length > 0) {
            amountRef.current?.focus();
            return;
        }

        setSaving(true);
        setFailure("");

        try {
            await onSave({ category, amount }, limit?.source ?? null);
            onClose();
        } catch (error) {
            setFailure(failureWords(error));
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        onClose();
        onRemove(limit.source);
    };

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            size="sm"
            title={limit ? `Limit on ${categoryLabel(limit.category).toLowerCase()}` : "Set a limit"}
            description="The most a category should take in one month."
            initialFocus={amountRef}
            className={styles.dialog}
            footer={
                <>
                    {limit && (
                        <Button variant="ghost" className={styles.remove} onClick={remove} disabled={saving}>
                            Remove limit
                        </Button>
                    )}
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {limit ? "Save" : "Set limit"}
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                {!limit && (
                    <Select
                        label="Category"
                        options={categories.map((name) => ({ value: name, label: categoryLabel(name) }))}
                        value={category}
                        error={errors.category}
                        onChange={(next) => {
                            setCategory(next);
                            setErrors({});
                        }}
                    />
                )}
                <Input
                    ref={amountRef}
                    label="A month"
                    placeholder="0"
                    inputMode="decimal"
                    autoComplete="off"
                    leading={<span aria-hidden="true">{currencySign(currency)}</span>}
                    value={amount}
                    error={errors.amount}
                    onChange={(event) => {
                        setAmount(event.target.value);
                        setErrors({});
                    }}
                />
                <FormFailure>{failure}</FormFailure>
            </form>
        </Dialog>
    );
};

export default LimitDialog;
