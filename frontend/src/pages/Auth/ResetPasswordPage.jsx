import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthLayout, { FormError, SlowNote } from "./AuthLayout";
import { Button, PasswordInput } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useSlow from "../../hooks/useSlow";
import {
    PASSWORD_HINT,
    SLOW_WORDS,
    checkNewPassword,
    isLinkToken,
    requestFailure,
} from "../../lib/authWords";
import { startsFocused } from "../../lib/platform";
import authService from "../../services/authService";
import styles from "./AuthLayout.module.css";

const NO_ERRORS = {};

const signInLink = (
    <Link to="/login" className={styles.link}>
        Back to sign in
    </Link>
);

/**
 * Where the link in a password-reset email leads: choose the new password. The server then signs the
 * account out everywhere, so this browser lets go of its session too and the visitor signs in afresh.
 */
const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const { token } = useParams();
    const { forgetSession } = useAuth();
    const passwordRef = useRef(null);

    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState(NO_ERRORS);
    const [busy, setBusy] = useState(false);
    // A link cut short in the mail app can be told at once; one that is too old, only when the server says so
    const [expired, setExpired] = useState(() => !isLinkToken(token));
    const slow = useSlow(busy);

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;

        const found = checkNewPassword({ password });
        if (found.password) {
            setErrors(found);
            passwordRef.current?.focus();
            return;
        }

        setBusy(true);
        try {
            await authService.resetPassword(token, password);
            forgetSession();
            navigate("/login", { replace: true, state: { arrival: "reset" } });
        } catch (error) {
            // Every 400 here is about the link: the password itself was checked before sending
            if (error.status === 400 && /token|link/i.test(error.message)) {
                setExpired(true);
            } else {
                setErrors(requestFailure(error));
            }
            setBusy(false);
        }
    };

    if (expired) {
        return (
            <AuthLayout
                title="This link has run out"
                lead="A reset link works once, for 15 minutes. Ask for a new one and use it straight away."
                foot={signInLink}
            >
                <div className={styles.form}>
                    <div className={styles.actions}>
                        <Button as={Link} to="/forgot-password" variant="primary" size="lg">
                            Send a new link
                        </Button>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Choose a new password"
            lead="Every device signed in to this account will be signed out."
            foot={signInLink}
        >
            <form className={styles.form} onSubmit={submit} noValidate>
                <PasswordInput
                    ref={passwordRef}
                    label="New password"
                    hint={PASSWORD_HINT}
                    name="password"
                    autoComplete="new-password"
                    autoFocus={startsFocused}
                    value={password}
                    error={errors.password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors(NO_ERRORS);
                    }}
                />
                <FormError>{errors.form}</FormError>
                <div className={styles.actions}>
                    <Button type="submit" variant="primary" size="lg" loading={busy}>
                        Save password
                    </Button>
                </div>
                {slow && <SlowNote>{SLOW_WORDS}</SlowNote>}
            </form>
        </AuthLayout>
    );
};

export default ResetPasswordPage;
