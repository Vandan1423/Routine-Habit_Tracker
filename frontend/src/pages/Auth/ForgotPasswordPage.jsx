import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout, { FormError, SlowNote } from "./AuthLayout";
import { Button, Input } from "../../components/ui";
import useSlow from "../../hooks/useSlow";
import { RESET_SENT, SLOW_WORDS, checkEmail, requestFailure } from "../../lib/authWords";
import { startsFocused } from "../../lib/platform";
import authService from "../../services/authService";
import styles from "./AuthLayout.module.css";

const NO_ERRORS = {};

/**
 * Asks for a link to choose a new password. The server answers the same way whether or not the address
 * has an account, and so does this page.
 */
const ForgotPasswordPage = () => {
    const { state } = useLocation();
    const emailRef = useRef(null);

    const [email, setEmail] = useState(state?.email ?? "");
    const [errors, setErrors] = useState(NO_ERRORS);
    const [busy, setBusy] = useState(false);
    const [sentTo, setSentTo] = useState("");
    const slow = useSlow(busy);

    const onward = state?.from ? { from: state.from } : undefined;

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;

        const found = checkEmail({ email });
        if (found.email) {
            setErrors(found);
            emailRef.current?.focus();
            return;
        }

        setBusy(true);
        try {
            await authService.forgotPassword(email.trim());
            setSentTo(email.trim());
        } catch (error) {
            setErrors(requestFailure(error));
        } finally {
            setBusy(false);
        }
    };

    const back = (
        <Link to="/login" state={{ ...onward, email: (sentTo || email).trim() || undefined }} className={styles.link}>
            Back to sign in
        </Link>
    );

    if (sentTo) {
        return (
            <AuthLayout title={RESET_SENT.title} lead={RESET_SENT.text(sentTo)} neighbour={back}>
                <p className={styles.more}>
                    Wrong address?{" "}
                    <button type="button" className={styles.textButton} onClick={() => setSentTo("")}>
                        Use a different one
                    </button>
                    .
                </p>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Reset your password"
            lead="Enter your account’s email and we’ll send a link to choose a new one."
            neighbour={back}
        >
            <form className={styles.form} onSubmit={submit} noValidate>
                <Input
                    ref={emailRef}
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus={startsFocused}
                    value={email}
                    error={errors.email}
                    onChange={(event) => {
                        setEmail(event.target.value);
                        setErrors(NO_ERRORS);
                    }}
                />
                <FormError>{errors.form}</FormError>
                <div className={styles.actions}>
                    <Button type="submit" variant="primary" size="lg" loading={busy}>
                        Send the link
                    </Button>
                </div>
                {slow && <SlowNote>{SLOW_WORDS}</SlowNote>}
            </form>
        </AuthLayout>
    );
};

export default ForgotPasswordPage;
