import { useId, useRef, useState } from "react";
import {
    Button,
    DatePicker,
    Dialog,
    Icon,
    Input,
    SegmentedControl,
    Select,
    Textarea,
    TimePicker,
    WeekdayPicker,
} from "../ui";
import useLastValue from "../../hooks/useLastValue";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { localDay } from "../../lib/dates";
import { BLOCKS } from "../../lib/day";
import {
    CATEGORIES,
    emptyForm,
    formOf,
    payloadOf,
    sameForm,
    validate,
} from "../../lib/itemForm";
import { KIND_WORDS, notSavedWords, stakesWords } from "../../lib/itemWords";
import { HABIT_XP, ROUTINE_XP } from "../../lib/stakes";
import { toast } from "../../lib/toast";
import { newKey } from "../../services/outbox";
import styles from "./ItemEditor.module.css";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const DAY_SHORTCUTS = [
    { label: "Every day", days: EVERY_DAY },
    { label: "Weekdays", days: [1, 2, 3, 4, 5] },
    { label: "Weekends", days: [0, 6] },
];

const REPEATS = [
    { value: "weekly", label: "Every week" },
    { value: "once", label: "Once" },
];
const TRACKING = [
    { value: "boolean", label: "Done or not" },
    { value: "quantity", label: "An amount" },
];
const DIFFICULTY = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
];
const PARTS_OF_DAY = BLOCKS.map((block) => ({ value: block.id, label: block.label }));

const INTRO = {
    routine: "Something with a time of day.",
    habit: "Something to keep up, with no set time.",
};

// The server said no, or could not be reached
const reasonOf = (error) =>
    error?.cause?.response
        ? error.message
        : "It couldn’t be saved. Check your connection and try again.";

// The days of the week, with the usual sets one press away
const DaysField = ({ value, error, onChange }) => (
    <div>
        <WeekdayPicker label="Days" value={value} error={error} onChange={onChange} />
        <div className={styles.shortcuts}>
            {DAY_SHORTCUTS.map((shortcut) => (
                <Button
                    key={shortcut.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(shortcut.days)}
                >
                    {shortcut.label}
                </Button>
            ))}
        </div>
    </div>
);

/**
 * The form a routine or a habit is made and changed in: a dialog, or a sheet on a phone.
 * It waits for the server before closing, and says why if the server refuses.
 *
 * request: what to open with, or null while closed:
 *   { kind: "routine" | "habit", item?, block?, once? }
 *   item: the routine or habit to change, as the API sent it. Without one, a new one is made.
 *   block: the part of the day a new habit starts out in. once: a new routine starts out as a one-off task.
 * onClose(): it wants to close
 * onSaved(item, { created }): it was saved. onDeleted(item): "Delete" was chosen, and the item is on its way out.
 */
const ItemEditor = ({ request, onClose, onSaved, onDeleted }) => {
    const formId = useId();
    const formRef = useRef(null);
    const { createItem, updateItem, deleteItem } = usePlan();
    const { date } = useToday();
    const today = date ?? localDay();

    // What it is showing stays in place while it closes
    const shown = useLastValue(request);
    const kind = shown?.kind ?? "routine";
    const item = shown?.item ?? null;

    const [seen, setSeen] = useState(null);
    const [form, setForm] = useState(() => emptyForm("routine"));
    const [initial, setInitial] = useState(form);
    const [errors, setErrors] = useState({});
    const [failure, setFailure] = useState("");
    const [saving, setSaving] = useState(false);
    const [more, setMore] = useState(false);

    // Opened afresh: start from the item, or from nothing
    if (request !== seen) {
        setSeen(request);

        if (request) {
            const start = request.item
                ? formOf(request.kind, request.item, { today })
                : emptyForm(request.kind, { today, block: request.block, once: request.once });

            setForm(start);
            setInitial(start);
            setErrors({});
            setFailure("");
            setSaving(false);
            // Notes and a category that are already there are shown; otherwise they wait behind a button
            setMore(Boolean(start.description) || start.category !== "personal");
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

        const found = validate(kind, form, { today, keepsDate: item?.date ?? null });
        setErrors(found);
        if (Object.keys(found).length > 0) {
            requestAnimationFrame(() =>
                formRef.current?.querySelector("[aria-invalid='true']")?.focus(),
            );
            return;
        }

        // It is in the plan the moment it is sent, so the form does not wait. If the server refuses, the
        // plan takes it back and a toast says why; trying again sends the same thing under the same key.
        const data = payloadOf(kind, form);
        const key = newKey();
        const send = () =>
            (item ? updateItem(kind, item._id, data) : createItem(kind, data, key)).then(
                (saved) => onSaved?.(saved, { created: !item }),
                (error) =>
                    toast.error(notSavedWords(data.title, Boolean(item)), {
                        detail: reasonOf(error),
                        action: { label: "Try again", onClick: send },
                    }),
            );

        send();
        onClose();
    };

    const remove = () => {
        onClose();
        onDeleted?.(item);
        deleteItem(kind, item);
    };

    const words = KIND_WORDS[kind];
    const worth = kind === "habit" ? HABIT_XP[form.difficulty] : (item?.xpReward ?? ROUTINE_XP);
    const stakes = stakesWords(kind, {
        worth,
        hasEnd: Boolean(form.endTime),
        once: form.repeats === "once",
    });

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={item ? `Edit ${words.name}` : `New ${words.name}`}
            description={item ? undefined : INTRO[kind]}
            // A press outside closes it only while nothing typed would be lost
            dismissible={sameForm(form, initial)}
            className={styles.dialog}
            footer={
                <>
                    {item && (
                        <Button variant="ghost" className={styles.delete} onClick={remove} disabled={saving}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {item ? "Save" : `Add ${words.name}`}
                    </Button>
                </>
            }
        >
            <form id={formId} ref={formRef} className={styles.form} onSubmit={submit} noValidate>
                <Input
                    label="Name"
                    placeholder={kind === "routine" ? "Morning walk" : "Read"}
                    value={form.title}
                    error={errors.title}
                    maxLength={120}
                    autoComplete="off"
                    onChange={setText("title")}
                />

                {kind === "routine" ? (
                    <>
                        <div className={styles.pair}>
                            <TimePicker
                                label="Starts"
                                value={form.startTime}
                                error={errors.startTime}
                                onChange={set("startTime")}
                            />
                            <TimePicker
                                label="Ends"
                                placeholder="No end"
                                value={form.endTime}
                                error={errors.endTime}
                                onChange={set("endTime")}
                            />
                        </div>
                        <div className={styles.group}>
                            <SegmentedControl
                                label="Repeats"
                                options={REPEATS}
                                value={form.repeats}
                                onChange={set("repeats")}
                                className={styles.choice}
                            />
                            {form.repeats === "weekly" ? (
                                <DaysField value={form.days} error={errors.days} onChange={set("days")} />
                            ) : (
                                <DatePicker
                                    label="Day"
                                    value={form.date}
                                    error={errors.date}
                                    today={today}
                                    min={today}
                                    onChange={set("date")}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.labelled}>
                            <span className={styles.label}>Part of the day</span>
                            <SegmentedControl
                                label="Part of the day"
                                options={PARTS_OF_DAY}
                                value={form.timeOfDay}
                                onChange={set("timeOfDay")}
                                className={styles.wide}
                            />
                        </div>
                        <DaysField value={form.days} error={errors.days} onChange={set("days")} />
                        <div className={styles.group}>
                            <div className={styles.labelled}>
                                <span className={styles.label}>Kept as</span>
                                <SegmentedControl
                                    label="Kept as"
                                    options={TRACKING}
                                    value={form.tracking}
                                    onChange={set("tracking")}
                                    className={styles.choice}
                                />
                            </div>
                            {form.tracking === "quantity" && (
                                <div className={styles.pair}>
                                    <Input
                                        label="Target for a day"
                                        placeholder="20"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={form.target}
                                        error={errors.target}
                                        onChange={setText("target")}
                                    />
                                    <Input
                                        label="Counted in"
                                        placeholder="pages"
                                        maxLength={30}
                                        autoComplete="off"
                                        value={form.unit}
                                        onChange={setText("unit")}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={styles.labelled}>
                            <span className={styles.label}>How hard it is</span>
                            <SegmentedControl
                                label="How hard it is"
                                options={DIFFICULTY}
                                value={form.difficulty}
                                onChange={set("difficulty")}
                                className={styles.choice}
                            />
                        </div>
                    </>
                )}

                {more ? (
                    <>
                        <Select
                            label="Category"
                            options={CATEGORIES}
                            value={form.category}
                            onChange={set("category")}
                        />
                        <Textarea
                            label="Notes"
                            rows={2}
                            maxLength={500}
                            value={form.description}
                            onChange={setText("description")}
                        />
                    </>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="plus"
                        className={styles.more}
                        onClick={() => setMore(true)}
                    >
                        Category and notes
                    </Button>
                )}

                <p className={styles.stakes}>{stakes}</p>

                <p className={cx(styles.failure, failure && styles.failed)} role="alert">
                    {failure && (
                        <>
                            <Icon name="alert" />
                            {failure}
                        </>
                    )}
                </p>
            </form>
        </Dialog>
    );
};

export default ItemEditor;
