import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Dialog, Input, Select } from "../ui";
import useTodos from "../../hooks/useTodos";
import { TODO_PATH } from "../../lib/places";
import { toast } from "../../lib/toast";
import { listLabel } from "../../lib/todos";
import { addedWords, notAddedWords, TODO_MAX } from "../../lib/todoWords";

/**
 * A to-do written down from wherever one happens to be: one line, and the list it goes on.
 * It closes as soon as the line is sent; if the server then refuses, a toast says so and offers to try again.
 * open, onOpenChange(open): whether it is showing
 */
const QuickTodo = ({ open, onOpenChange }) => {
    const formId = useId();
    const field = useRef(null);
    const navigate = useNavigate();
    const { status, lists, ensure, addTodo } = useTodos();

    const [seen, setSeen] = useState(false);
    const [title, setTitle] = useState("");
    const [listId, setListId] = useState("");
    const [error, setError] = useState("");

    // Opened afresh: an empty line
    if (open !== seen) {
        setSeen(open);
        if (open) {
            setTitle("");
            setError("");
        }
    }

    // The lists may not have been asked for yet, whichever screen this opened over
    useEffect(() => {
        if (open) ensure();
    }, [open, ensure]);

    const general = lists.find((list) => list.isDefault);
    const chosen = lists.find((list) => list._id === listId) ?? general ?? null;

    const submit = (event) => {
        event.preventDefault();

        const words = title.trim();
        if (!words) {
            setError("Write down what needs doing.");
            field.current?.focus();
            return;
        }

        const label = listLabel(chosen) || "To-do";
        const path = chosen && !chosen.isDefault ? `${TODO_PATH}/${chosen._id}` : TODO_PATH;

        const send = () => {
            const said = toast(addedWords(label), { action: { label: "Show", onClick: () => navigate(path) } });

            addTodo(words, chosen?._id).catch((failure) => {
                const refused = notAddedWords(words, failure);

                toast.dismiss(said);
                toast.error(refused.message, {
                    detail: refused.detail,
                    action: { label: "Try again", onClick: send },
                });
            });
        };

        onOpenChange(false);
        send();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title="New to-do"
            footer={
                <>
                    <Button onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId}>
                        Add
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--s-4)" }}>
                <Input
                    ref={field}
                    label="To-do"
                    placeholder="Book the dentist"
                    value={title}
                    maxLength={TODO_MAX}
                    autoComplete="off"
                    error={error}
                    onChange={(event) => {
                        setTitle(event.target.value);
                        if (error) setError("");
                    }}
                />
                {/* With one list there is nothing to choose */}
                {status === "ready" && lists.length > 1 && (
                    <Select
                        label="List"
                        options={lists.map((list) => ({ value: list._id, label: listLabel(list) }))}
                        value={chosen?._id ?? ""}
                        onChange={setListId}
                    />
                )}
            </form>
        </Dialog>
    );
};

export default QuickTodo;
