import { useId, useRef, useState } from "react";
import { Button, Dialog, Input } from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import { listNameError, NOT_SAVED_WORDS } from "../../lib/todoWords";

/**
 * The form a list is named in: a new one, or one being renamed.
 *
 * request: { list } to rename that list, {} for a new one, null while closed
 * onSave(name, list): resolves once saved, rejects with the reason if it was not
 * onClose(): it wants to close
 */
const ListDialog = ({ request, onSave, onClose }) => {
    const formId = useId();
    const field = useRef(null);
    // What it is about stays in place while it closes
    const shown = useLastValue(request);
    const renaming = Boolean(shown?.list);

    const [seen, setSeen] = useState(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    // Opened afresh: it starts from the list's own name, or from nothing
    if (request !== seen) {
        setSeen(request);
        if (request) {
            setName(request.list?.name ?? "");
            setError("");
        }
    }

    const close = () => {
        if (!saving) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;

        const problem = listNameError(name);
        if (problem) {
            setError(problem);
            field.current?.focus();
            return;
        }

        setSaving(true);
        try {
            // Usually done at once: the list is shown before the server has answered
            await onSave(name.trim(), shown?.list ?? null);
            onClose();
        } catch (failure) {
            setError(failure?.message || NOT_SAVED_WORDS);
            field.current?.select();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            size="sm"
            title={renaming ? "Rename list" : "New list"}
            footer={
                <>
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {renaming ? "Rename" : "Create list"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={submit} noValidate>
                <Input
                    ref={field}
                    label="Name"
                    value={name}
                    maxLength={60}
                    placeholder="Groceries"
                    autoComplete="off"
                    error={error}
                    onChange={(event) => {
                        setName(event.target.value);
                        if (error) setError("");
                    }}
                />
            </form>
        </Dialog>
    );
};

export default ListDialog;
