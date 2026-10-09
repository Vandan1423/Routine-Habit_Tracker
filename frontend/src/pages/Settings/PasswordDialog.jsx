import { useId, useRef, useState } from "react";
import { Button, Dialog, PasswordInput } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import { toast } from "../../lib/toast";
import styles from "./SettingsPage.module.css";

// The shortest password the server takes (registerSchema)
const SHORTEST = 6;

const NO_ERRORS = {};

/**
 * Changes the account's password. The current one is asked for first; once the change is made the server
 * signs out every other device, and this one carries on.
 * open: whether it is showing. onClose(): it wants to close.
 */
const PasswordDialog = ({ open, onClose }) => {
    const formId = useId();
    const currentRef = useRef(null);
    const { user, changePassword } = useAuth();

    const [seen, setSeen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [errors, setErrors] = useState(NO_ERRORS);
    const [saving, setSaving] = useState(false);

    // Opened afresh: nothing typed last time is still there
    if (open !== seen) {
        setSeen(open);
        if (open) {
            setCurrent("");
            setNext("");
            setErrors(NO_ERRORS);
        }
    }

    const close = () => {
        if (!saving) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;

        const found = {};
        if (!current) found.current = "Enter your current password.";
        if (next.length < SHORTEST) found.next = `Use at least ${SHORTEST} characters.`;
        else if (next === current) found.next = "Choose one you are not using now.";

        if (Object.keys(found).length > 0) {
            setErrors(found);
            return;
        }

        setSaving(true);
        try {
            await changePassword(current, next);
            onClose();
            toast("Password changed", { detail: "Other devices signed out" });
        } catch (error) {
            if (error.code === "WRONG_PASSWORD") {
                setErrors({ current: "That isn’t your current password." });
                // Ready to be typed again
                currentRef.current?.select();
            } else {
                setErrors({ form: error.message });
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) close();
            }}
            title="Change password"
            description="Your other devices will be signed out."
            dismissible={false}
            footer={
                <>
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        Change password
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                {/* Tells a password manager whose password this is, so it updates the right entry */}
                <input type="text" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
                <PasswordInput
                    ref={currentRef}
                    label="Current password"
                    autoComplete="current-password"
                    value={current}
                    error={errors.current}
                    onChange={(event) => {
                        setCurrent(event.target.value);
                        setErrors(NO_ERRORS);
                    }}
                />
                <PasswordInput
                    label="New password"
                    hint={`At least ${SHORTEST} characters.`}
                    autoComplete="new-password"
                    value={next}
                    error={errors.next}
                    onChange={(event) => {
                        setNext(event.target.value);
                        setErrors(NO_ERRORS);
                    }}
                />
                {errors.form && (
                    <p className={styles.formError} role="alert">
                        {errors.form}
                    </p>
                )}
            </form>
        </Dialog>
    );
};

export default PasswordDialog;
