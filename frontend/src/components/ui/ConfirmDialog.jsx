import { useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import Button from "./Button";
import useMediaQuery from "../../hooks/useMediaQuery";
import { cx } from "../../lib/cx";
import styles from "./Dialog.module.css";

/**
 * A question that needs an answer before anything else happens, such as deleting something.
 * Unlike Dialog, a press outside does not close it; Esc and the cancel button do. Cancel is focused first.
 *
 * open, onOpenChange(open): whether it is showing. Or pass `trigger`, a button that opens it.
 * title: the question itself. description: what saying yes will do, in plain words.
 * confirmLabel: names the action ("Delete habit"), never just "OK". cancelLabel: "Cancel" unless given.
 * tone: "danger" when saying yes removes something.
 * onConfirm: runs when the answer is yes. If it returns a promise, the button shows it working;
 *            the question closes when the promise resolves, and stays open if it rejects.
 */
const ConfirmDialog = ({
    open,
    defaultOpen,
    onOpenChange,
    trigger,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone,
    onConfirm,
}) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const actionsRef = useRef(null);
    // The ref answers "is it working right now?" for the close guard; the state draws the button
    const workingRef = useRef(false);
    const [working, setWorking] = useState(false);

    const setBusy = (busy) => {
        workingRef.current = busy;
        setWorking(busy);
    };

    const confirm = async () => {
        setBusy(true);
        try {
            await onConfirm?.();
        } catch {
            // The caller says what went wrong. The question stays, so the answer can be given again.
            setBusy(false);
            return;
        }
        setBusy(false);
        actionsRef.current?.close();
    };

    const handleOpenChange = (nextOpen, details) => {
        // Not while the answer is being carried out
        if (workingRef.current && !nextOpen) {
            details.cancel();
            return;
        }
        onOpenChange?.(nextOpen, details);
    };

    return (
        <AlertDialog.Root
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={handleOpenChange}
            actionsRef={actionsRef}
        >
            {trigger && <AlertDialog.Trigger render={trigger} />}
            <AlertDialog.Portal>
                <AlertDialog.Backdrop className={styles.backdrop} />
                <AlertDialog.Viewport
                    className={cx(styles.viewport, isPhone && styles.sheetViewport)}
                >
                    <AlertDialog.Popup
                        className={cx(
                            styles.popup,
                            isPhone ? styles.sheet : cx(styles.panel, styles.sm),
                        )}
                    >
                        <div className={styles.content}>
                            <header className={styles.header}>
                                <div className={styles.heading}>
                                    <AlertDialog.Title className={styles.title}>
                                        {title}
                                    </AlertDialog.Title>
                                    {description && (
                                        <AlertDialog.Description className={styles.description}>
                                            {description}
                                        </AlertDialog.Description>
                                    )}
                                </div>
                            </header>
                            <footer className={styles.footer}>
                                <AlertDialog.Close render={<Button>{cancelLabel}</Button>} />
                                <Button
                                    variant={tone === "danger" ? "danger" : "primary"}
                                    loading={working}
                                    onClick={confirm}
                                >
                                    {confirmLabel}
                                </Button>
                            </footer>
                        </div>
                    </AlertDialog.Popup>
                </AlertDialog.Viewport>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
};

export default ConfirmDialog;
