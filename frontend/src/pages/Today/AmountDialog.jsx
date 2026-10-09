import { useId, useState } from "react";
import { Button, Dialog, Input } from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import { readAmount } from "../../lib/itemForm";

const amountFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const MOST = 1000000; // the largest count the API takes

/**
 * Asks how far a counted habit has got today, as a number typed in, for when stepping there
 * would take too long ("12 of 20 pages").
 *
 * item: the habit's row from buildDay, or null while closed
 * onSave(item, amount): the amount was given. onClose(): it wants to close.
 */
const AmountDialog = ({ item, onSave, onClose }) => {
    const formId = useId();
    const shown = useLastValue(item);

    const [seen, setSeen] = useState(null);
    const [text, setText] = useState("");
    const [error, setError] = useState("");

    // Opened afresh: start from where the habit stands
    if (item !== seen) {
        setSeen(item);
        if (item) {
            setText(item.quantity > 0 ? String(item.quantity) : "");
            setError("");
        }
    }

    const submit = (event) => {
        event.preventDefault();

        const amount = text.trim() === "" ? 0 : readAmount(text);
        if (!(amount >= 0) || amount > MOST) {
            setError("Enter a number, or leave it empty for none.");
            return;
        }

        onSave(shown, amount);
        onClose();
    };

    const unit = shown?.unit ?? "";
    const target = shown ? amountFormat.format(shown.target) : "";

    return (
        <Dialog
            open={Boolean(item)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            size="sm"
            title={shown?.title ?? ""}
            description={`Today’s target is ${target}${unit ? ` ${unit}` : ""}.`}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId}>
                        Save
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={submit} noValidate>
                <Input
                    label="Done so far today"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    trailing={unit || undefined}
                    value={text}
                    error={error}
                    onChange={(event) => {
                        setText(event.target.value);
                        setError("");
                    }}
                />
            </form>
        </Dialog>
    );
};

export default AmountDialog;
