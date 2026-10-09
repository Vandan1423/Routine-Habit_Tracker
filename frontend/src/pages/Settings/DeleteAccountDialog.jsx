import { useId, useRef, useState } from "react";
import { Button, Dialog, PasswordInput } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import { forget } from "../../lib/remembered";
import { toast } from "../../lib/toast";
import styles from "./SettingsPage.module.css";

/**
 * Deletes the account and everything in it, for good. Nothing brings it back, so the password is asked
 * for again and the button says exactly what it does.
 * open: whether it is showing. onClose(): it wants to close.
 */
const DeleteAccountDialog = ({ open, onClose }) => {
    const formId = useId();
    const passwordRef = useRef(null);
    const { user, deleteAccount } = useAuth();

    const [seen, setSeen] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);

    // Opened afresh: nothing typed last time is still there
    if (open !== seen) {
        setSeen(open);
        if (open) {
            setPassword("");
            setError("");
        }
    }

    const close = () => {
        if (!deleting) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (deleting) return;

        if (!password) {
            setError("Enter your password to confirm.");
            return;
        }

        const account = user?._id ?? user?.id ?? user?.email;

        setDeleting(true);
        try {
            // Once this resolves there is no account, and this screen is on its way out with it
            await deleteAccount(password);
            // What this browser remembered for the account (folded blocks, a recap put away) goes too
            forget(`today.${account}`);
            toast("Your account has been deleted");
        } catch (failure) {
            setError(
                failure.code === "WRONG_PASSWORD" ? "That isn’t your password." : failure.message,
            );
            setDeleting(false);
            passwordRef.current?.select();
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) close();
            }}
            title="Delete your account?"
            description="Your routines, habits, history, level and expenses are erased for good. This can’t be undone."
            dismissible={false}
            footer={
                <>
                    <Button onClick={close}>Keep my account</Button>
                    <Button variant="danger" type="submit" form={formId} loading={deleting}>
                        Delete account
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                <input type="text" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
                <PasswordInput
                    ref={passwordRef}
                    label="Password"
                    hint="Enter it to confirm that this is you."
                    autoComplete="current-password"
                    value={password}
                    error={error}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                    }}
                />
            </form>
        </Dialog>
    );
};

export default DeleteAccountDialog;
