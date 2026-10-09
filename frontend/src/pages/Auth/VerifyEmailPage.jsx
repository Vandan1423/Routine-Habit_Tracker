import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AuthLayout, { FormError, Notice, SlowNote } from "./AuthLayout";
import { HOME_PATH } from "../../components/shell/navigation";
import { Button, Input, Loader } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useSlow from "../../hooks/useSlow";
import { SLOW_WORDS, checkEmail, isLinkToken, requestFailure } from "../../lib/authWords";
import authService from "../../services/authService";
import styles from "./AuthLayout.module.css";

const NO_ERRORS = {};

const signInLink = (
    <Link to="/login" className={styles.link}>
        Back to sign in
    </Link>
);

// The link did not work: ask for the address and send a new one
const NewLink = () => {
    const emailRef = useRef(null);
    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState(NO_ERRORS);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

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
            await authService.resendVerification(email.trim());
            setSent(true);
        } catch (error) {
            setErrors(requestFailure(error));
        } finally {
            setBusy(false);
        }
    };

    if (sent) {
        // The server does not say whether the address has an account waiting, and neither does this
        return <Notice>If that account is waiting to be confirmed, a new link is on its way.</Notice>;
    }

    return (
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
                    Send a new link
                </Button>
            </div>
        </form>
    );
};

/**
 * Where the link in a confirmation email leads. The confirming happens by itself as the page opens;
 * what is shown is how it went. Opening the same link twice is fine: the server says "confirmed" both times.
 */
const VerifyEmailPage = () => {
    const { token } = useParams();
    const { isAuthenticated } = useAuth();
    // "checking", then "confirmed", "refused" (the link is no good) or "unreachable" (no answer at all)
    const [status, setStatus] = useState(() => (isLinkToken(token) ? "checking" : "refused"));
    const [attempt, setAttempt] = useState(0);
    const slow = useSlow(status === "checking");

    useEffect(() => {
        if (!isLinkToken(token)) return undefined;

        let current = true;

        authService
            .verifyEmail(token)
            .then(() => current && setStatus("confirmed"))
            .catch((error) => current && setStatus(error.status ? "refused" : "unreachable"));

        return () => {
            current = false;
        };
    }, [token, attempt]);

    if (status === "checking") {
        return (
            <AuthLayout title="Confirming your email" foot={signInLink}>
                <div className={styles.form}>
                    <Loader label="Confirming your email" />
                    {slow && <SlowNote>{SLOW_WORDS}</SlowNote>}
                </div>
            </AuthLayout>
        );
    }

    if (status === "confirmed") {
        return (
            <AuthLayout
                title="Your email is confirmed"
                lead={isAuthenticated ? "Your account is ready." : "Your account is ready. Sign in to begin."}
                foot={null}
            >
                <div className={styles.form}>
                    <div className={styles.actions}>
                        {isAuthenticated ? (
                            <Button as={Link} to={HOME_PATH} variant="primary" size="lg">
                                Go to Today
                            </Button>
                        ) : (
                            <Button as={Link} to="/login" variant="primary" size="lg">
                                Sign in
                            </Button>
                        )}
                    </div>
                </div>
            </AuthLayout>
        );
    }

    if (status === "unreachable") {
        return (
            <AuthLayout
                title="Your email isn’t confirmed yet"
                lead="The server couldn’t be reached. The link is still good; try it again."
                foot={signInLink}
            >
                <div className={styles.form}>
                    <div className={styles.actions}>
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={() => {
                                setStatus("checking");
                                setAttempt((count) => count + 1);
                            }}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="This link didn’t work"
            lead="A confirmation link works for 24 hours, and only the newest one counts. Enter your email for a new one."
            foot={signInLink}
        >
            <NewLink />
        </AuthLayout>
    );
};

export default VerifyEmailPage;
