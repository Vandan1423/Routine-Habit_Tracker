import { useId, useRef, useState } from "react";
import AccountField from "./AccountField";
import FormFailure from "./FormFailure";
import { Button, DatePicker, Dialog, Input, SegmentedControl, Select } from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import { formatDayPlain } from "../../lib/dates";
import {
    CATEGORIES,
    emptySubscription,
    FREQUENCIES,
    sameAnswers,
    subscriptionFormOf,
    subscriptionPayload,
    validateSubscription,
} from "../../lib/expenses";
import { categoryLabel, failureWords, FREQUENCY_LABELS } from "../../lib/expenseWords";
import { currencySign } from "../../lib/money";
import styles from "./forms.module.css";

const FREQUENCY_OPTIONS = FREQUENCIES.map((frequency) => ({ value: frequency, label: FREQUENCY_LABELS[frequency] }));
const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) }));

/**
 * The form a subscription is made and changed in: something paid again and again, and when it next falls due.
 * Nothing is ever logged for it by itself; "Mark as paid" on its row does that.
 *
 * request: what to open with, or null while closed: { subscription? }, the one to change as the API sent it
 * accounts, today, currency: from buildExpenseMonth
 * onSave(payload, subscription): saves it; rejects if it could not be saved
 * onDelete(subscription): "Delete" was chosen. onClose(): it wants to close.
 */
const SubscriptionEditor = ({ request, accounts, today, currency, onSave, onDelete, onClose }) => {
    const formId = useId();
    const formRef = useRef(null);

    // What it is showing stays in place while it closes
    const shown = useLastValue(request);
    const subscription = shown?.subscription ?? null;

    const [seen, setSeen] = useState(null);
    const [form, setForm] = useState(() => emptySubscription());
    const [initial, setInitial] = useState(form);
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [saving, setSaving] = useState(false);

    // Opened afresh: start from the subscription, or from nothing
    if (request !== seen) {
        setSeen(request);

        if (request) {
            const start = request.subscription
                ? subscriptionFormOf(request.subscription)
                : emptySubscription({ today, accounts });

            setForm(start);
            setInitial(start);
            setErrors({});
            setFailure("");
            setSaving(false);
        }
    }

    const set = (field) => (value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    };
    const setText = (field) => (event) => set(field)(event.target.value);

    const close = () => {
        if (!saving) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;

        const found = validateSubscription(form);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid='true']")?.focus());
            return;
        }

        setSaving(true);
        setFailure("");

        try {
            await onSave(subscriptionPayload(form), subscription);
            onClose();
        } catch (error) {
            setFailure(failureWords(error));
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        onClose();
        onDelete(subscription);
    };

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={subscription ? "Edit subscription" : "New subscription"}
            description={subscription ? undefined : "Something you pay again and again."}
            // A press outside closes it only while nothing typed would be lost
            dismissible={sameAnswers(form, initial)}
            className={styles.dialog}
            footer={
                <>
                    {subscription && (
                        <Button variant="ghost" className={styles.remove} onClick={remove} disabled={saving}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {subscription ? "Save" : "Add subscription"}
                    </Button>
                </>
            }
        >
            <form id={formId} ref={formRef} className={styles.form} onSubmit={submit} noValidate>
                <div className={styles.pair}>
                    <Input
                        label="Name"
                        placeholder="Rent"
                        maxLength={120}
                        autoComplete="off"
                        value={form.name}
                        error={errors.name}
                        onChange={setText("name")}
                    />
                    <Input
                        label="Amount"
                        placeholder="0"
                        inputMode="decimal"
                        autoComplete="off"
                        leading={<span aria-hidden="true">{currencySign(currency)}</span>}
                        value={form.amount}
                        error={errors.amount}
                        onChange={setText("amount")}
                    />
                </div>

                <div className={styles.labelled}>
                    <span className={styles.label}>Paid</span>
                    <SegmentedControl
                        label="Paid"
                        options={FREQUENCY_OPTIONS}
                        value={form.frequency}
                        onChange={set("frequency")}
                        className={styles.choice}
                    />
                </div>

                <div className={styles.pair}>
                    <DatePicker
                        label="Next due"
                        value={form.due}
                        error={errors.due}
                        today={today}
                        format={formatDayPlain}
                        onChange={set("due")}
                    />
                    <Select
                        label="Category"
                        options={CATEGORY_OPTIONS}
                        value={form.category}
                        onChange={set("category")}
                    />
                </div>

                {accounts.length > 1 && (
                    <AccountField
                        label="Paid from"
                        accounts={accounts}
                        value={form.accountId}
                        error={errors.accountId}
                        onChange={set("accountId")}
                    />
                )}

                <p className={styles.note}>
                    Nothing is logged by itself. When you pay it, mark it as paid: that logs the expense and
                    moves the due date on.
                </p>

                <FormFailure>{failure}</FormFailure>
            </form>
        </Dialog>
    );
};

export default SubscriptionEditor;
