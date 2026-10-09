import { useId, useRef, useState } from "react";
import AccountField from "./AccountField";
import FormFailure from "./FormFailure";
import {
    Button,
    DatePicker,
    Dialog,
    Input,
    SegmentedControl,
    Select,
    SuggestInput,
    Textarea,
} from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import {
    CATEGORIES,
    emptyTransaction,
    PAYMENT_METHODS,
    sameAnswers,
    transactionFormOf,
    transactionPayload,
    TYPES,
    validateTransaction,
    withAccount,
} from "../../lib/expenses";
import { categoryLabel, failureWords, ledgerDayWords, METHOD_LABELS, TYPE_LABELS } from "../../lib/expenseWords";
import { currencySign } from "../../lib/money";
import styles from "./forms.module.css";

const TYPE_OPTIONS = TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }));
const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) }));
const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }));

const TITLES = {
    expense: { new: "New expense", edit: "Edit expense", add: "Add expense" },
    income: { new: "New income", edit: "Edit income", add: "Add income" },
    transfer: { new: "New transfer", edit: "Edit transfer", add: "Add transfer" },
};

const WHAT_FOR = {
    expense: { label: "What for", placeholder: "Groceries" },
    income: { label: "What for", placeholder: "Salary" },
    transfer: { label: "What for", placeholder: "Cash for the week" },
};

/**
 * The form money is logged in: something spent, something that came in, or a move between two accounts.
 * A dialog, or a sheet on a phone. It waits for the server before closing, and says why if the server refuses.
 *
 * request: what to open with, or null while closed: { type?, transaction? }
 *   transaction: the one to change, as the API sent it. Without one, a new one is made, of `type`.
 * accounts, today, currency, places: from buildExpenseMonth (places are the ones typed before)
 * onSave(payload, transaction): saves it; rejects if it could not be saved
 * onDelete(transaction): "Delete" was chosen. onClose(): it wants to close.
 */
const TransactionEditor = ({ request, accounts, today, currency, places, onSave, onDelete, onClose }) => {
    const formId = useId();
    const formRef = useRef(null);
    const amountRef = useRef(null);

    // What it is showing stays in place while it closes
    const shown = useLastValue(request);
    const transaction = shown?.transaction ?? null;

    const [seen, setSeen] = useState(null);
    const [form, setForm] = useState(() => emptyTransaction());
    const [initial, setInitial] = useState(form);
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [saving, setSaving] = useState(false);
    const [more, setMore] = useState(false);

    // Opened afresh: start from the transaction, or from nothing
    if (request !== seen) {
        setSeen(request);

        if (request) {
            const start = request.transaction
                ? transactionFormOf(request.transaction, { accounts })
                : emptyTransaction({ today, accounts, type: request.type });

            setForm(start);
            setInitial(start);
            setErrors({});
            setFailure("");
            setSaving(false);
            // Notes that are already there are shown; otherwise they wait, with how it was paid, behind a button
            setMore(Boolean(start.notes));
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

        const found = validateTransaction(form);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            requestAnimationFrame(() => formRef.current?.querySelector("[aria-invalid='true']")?.focus());
            return;
        }

        setSaving(true);
        setFailure("");

        try {
            await onSave(transactionPayload(form), transaction);
            onClose();
        } catch (error) {
            setFailure(failureWords(error));
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        onClose();
        onDelete(transaction);
    };

    const { type } = form;
    const titles = TITLES[type];
    const several = accounts.length > 1;

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={transaction ? titles.edit : titles.new}
            // A press outside closes it only while nothing typed would be lost
            dismissible={sameAnswers(form, initial)}
            // Whatever it is, the figure is typed first
            initialFocus={amountRef}
            className={styles.dialog}
            footer={
                <>
                    {transaction && (
                        <Button variant="ghost" className={styles.remove} onClick={remove} disabled={saving}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {transaction ? "Save" : titles.add}
                    </Button>
                </>
            }
        >
            <form id={formId} ref={formRef} className={styles.form} onSubmit={submit} noValidate>
                <SegmentedControl
                    label="What it is"
                    options={TYPE_OPTIONS}
                    value={type}
                    onChange={set("type")}
                />

                <div className={styles.pair}>
                    <Input
                        ref={amountRef}
                        label="Amount"
                        placeholder="0"
                        inputMode="decimal"
                        autoComplete="off"
                        leading={<span aria-hidden="true">{currencySign(currency)}</span>}
                        value={form.amount}
                        error={errors.amount}
                        onChange={setText("amount")}
                    />
                    <DatePicker
                        label="Day"
                        value={form.date}
                        error={errors.date}
                        today={today}
                        // Something dated ahead before now may keep its day; nothing new is logged ahead
                        max={form.date > today ? form.date : today}
                        format={(day) => ledgerDayWords(day, today)}
                        onChange={set("date")}
                    />
                </div>

                <Input
                    label={WHAT_FOR[type].label}
                    placeholder={WHAT_FOR[type].placeholder}
                    maxLength={500}
                    autoComplete="off"
                    value={form.description}
                    onChange={setText("description")}
                />

                {type === "expense" && (
                    <div className={styles.pair}>
                        <Select
                            label="Category"
                            options={CATEGORY_OPTIONS}
                            value={form.category}
                            onChange={set("category")}
                        />
                        <SuggestInput
                            label="Place"
                            placeholder="Optional"
                            maxLength={120}
                            suggestions={places}
                            value={form.place}
                            onChange={set("place")}
                        />
                    </div>
                )}

                {several && (
                    <AccountField
                        label={type === "income" ? "Into" : "From"}
                        accounts={accounts}
                        value={form.accountId}
                        error={errors.accountId}
                        onChange={(accountId) => setForm((current) => withAccount(current, accountId, accounts))}
                    />
                )}
                {type === "transfer" && (
                    <AccountField
                        label="To"
                        accounts={accounts}
                        without={form.accountId}
                        value={form.toAccountId}
                        error={errors.toAccountId}
                        onChange={set("toAccountId")}
                    />
                )}

                {more ? (
                    <>
                        {type === "expense" && (
                            <Select
                                label="Paid by"
                                options={METHOD_OPTIONS}
                                value={form.method}
                                onChange={set("method")}
                            />
                        )}
                        <Textarea
                            label="Notes"
                            rows={2}
                            maxLength={1000}
                            value={form.notes}
                            onChange={setText("notes")}
                        />
                    </>
                ) : (
                    <Button variant="ghost" size="sm" icon="plus" className={styles.more} onClick={() => setMore(true)}>
                        {type === "expense" ? "How it was paid, and notes" : "Notes"}
                    </Button>
                )}

                <FormFailure>{failure}</FormFailure>
            </form>
        </Dialog>
    );
};

export default TransactionEditor;
