import { useId, useRef, useState } from "react";
import Button from "../ui/Button";
import DatePicker from "../ui/DatePicker";
import Dialog from "../ui/Dialog";
import Input from "../ui/Input";
import Select from "../ui/Select";
import TimePicker from "../ui/TimePicker";
import useLastValue from "../../hooks/useLastValue";
import useTodos from "../../hooks/useTodos";
import useToday from "../../hooks/useToday";
import { localDay } from "../../lib/dates";
import { fromMinutes, toMinutes } from "../../lib/time";
import { toast } from "../../lib/toast";
import { listLabel } from "../../lib/todos";
import { notAddedWords, PAST_DAY_WORDS, TODO_MAX } from "../../lib/todoWords";
import styles from "./TodoPlanDialog.module.css";

const formOf = (request) => ({
    title: request?.todo?.title ?? "",
    date: request?.todo ? (request.todo.date ?? "") : (request?.date ?? ""),
    time: request?.todo ? (request.todo.time ?? "") : (request?.time ?? ""),
    endTime: request?.todo ? (request.todo.endTime ?? "") : (request?.endTime ?? ""),
    listId: request?.todo?.list ?? request?.listId ?? "",
});

const same = (a, b) => Object.keys(a).every((field) => a[field] === b[field]);

/**
 * A to-do in full: its words, the day it is planned for, and when on that day. Week opens it to add one
 * at a time on the hour grid and to change one; Today and the To-do screen open it to plan one for a day.
 * Like every change to the lists it is shown at once and sent after, and a refusal is said in a toast.
 *
 * request: what to open with, or null while closed: { todo?, date?, time?, endTime?, listId? }
 *   todo: the one to change, as the API sends it. Without one a new one is written, on the day and at the
 *   time given (none unless given), on the list given (the general one unless given).
 * onClose()
 */
const TodoPlanDialog = ({ request, onClose }) => {
    const formId = useId();
    const nameRef = useRef(null);
    const { lists, addTodo, renameTodo, planTodo, moveTodo, deleteTodo } = useTodos();
    const { date: accountToday } = useToday();
    const today = accountToday ?? localDay();

    const shown = useLastValue(request);
    const todo = shown?.todo ?? null;

    const [seen, setSeen] = useState(null);
    const [form, setForm] = useState(() => formOf(null));
    const [initial, setInitial] = useState(form);
    const [errors, setErrors] = useState({});

    if (request !== seen) {
        setSeen(request);
        if (request) {
            const start = formOf(request);
            setForm(start);
            setInitial(start);
            setErrors({});
        }
    }

    const set = (field) => (value) => {
        setForm((current) => {
            const next = { ...current, [field]: value };
            // A time belongs to a day, and an end to a start
            if (field === "date" && !value) Object.assign(next, { time: "", endTime: "" });
            if (field === "time" && !value) next.endTime = "";
            return next;
        });
        setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    };

    // A day already gone can stay as it is (it was planned before it passed); it cannot be newly chosen
    const kept = todo?.date && todo.date < today ? todo.date : null;

    const submit = (event) => {
        event.preventDefault();

        const title = form.title.trim();
        const found = {};
        if (!title) found.title = "Write what it is.";
        if (form.date && form.date < today && form.date !== kept) found.date = PAST_DAY_WORDS;
        if (form.time && form.endTime && form.endTime <= form.time) found.endTime = "The end has to come after the start.";
        setErrors(found);
        if (Object.keys(found).length > 0) {
            requestAnimationFrame(() => document.getElementById(formId)?.querySelector("[aria-invalid='true']")?.focus());
            return;
        }

        const planned = { date: form.date || null, time: form.time || null, endTime: form.endTime || null };

        if (!todo) {
            addTodo(title, form.listId || undefined, planned).catch((failure) => {
                const words = notAddedWords(title, failure);
                toast.error(words.message, { detail: words.detail });
            });
        } else {
            if (title !== todo.title) renameTodo(todo, title);
            const changed = Object.fromEntries(
                Object.entries(planned).filter(([field, value]) => value !== (todo[field] ?? null)),
            );
            if (Object.keys(changed).length > 0) planTodo(todo, changed);
            if (form.listId && form.listId !== todo.list) moveTodo(todo, form.listId);
        }
        onClose();
    };

    const remove = () => {
        onClose();
        deleteTodo(todo);
    };

    const listOptions = lists.map((list) => ({ value: list._id, label: listLabel(list) }));

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={todo ? "Edit to-do" : "New to-do"}
            description={todo ? undefined : "Something to get done. It earns no XP and costs none."}
            dismissible={same(form, initial)}
            initialFocus={nameRef}
            className={styles.dialog}
            footer={
                <>
                    {todo && (
                        <Button variant="ghost" className={styles.delete} onClick={remove}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId}>
                        {todo ? "Save" : "Add to-do"}
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                <Input
                    ref={nameRef}
                    label="Name"
                    placeholder="Call the plumber"
                    value={form.title}
                    error={errors.title}
                    maxLength={TODO_MAX}
                    autoComplete="off"
                    onChange={(event) => set("title")(event.target.value)}
                />
                <div className={styles.day}>
                    <DatePicker
                        label="Day"
                        placeholder="No day"
                        value={form.date}
                        error={errors.date}
                        today={today}
                        min={kept ?? today}
                        onChange={set("date")}
                    />
                    {form.date && (
                        <Button variant="ghost" size="sm" className={styles.noDay} onClick={() => set("date")("")}>
                            No day
                        </Button>
                    )}
                </div>
                <div className={styles.pair}>
                    <TimePicker
                        label="Starts"
                        placeholder={form.date ? "Any time" : "Choose a day first"}
                        clearable
                        disabled={!form.date}
                        openAt="09:00"
                        value={form.time}
                        onChange={set("time")}
                    />
                    <TimePicker
                        label="Ends"
                        placeholder="No end"
                        clearable
                        disabled={!form.time}
                        openAt={form.time ? fromMinutes(toMinutes(form.time) + 30) : undefined}
                        value={form.endTime}
                        error={errors.endTime}
                        onChange={set("endTime")}
                    />
                </div>
                {listOptions.length > 1 && (
                    <Select label="List" options={listOptions} value={form.listId || listOptions[0].value} onChange={set("listId")} />
                )}
                <p className={styles.note}>
                    {form.date
                        ? "It shows on Week and on Today on its day. Left undone, it stays on its day until you move it."
                        : "With no day it waits on its list, ready to be planned for one."}
                </p>
            </form>
        </Dialog>
    );
};

export default TodoPlanDialog;
