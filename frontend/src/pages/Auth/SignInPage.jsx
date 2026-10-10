import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout, { FormError, Notice, SlowNote } from "./AuthLayout";
import ResendLink from "./ResendLink";
import { Button, Input, PasswordInput } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useSlow from "../../hooks/useSlow";
import { APP_NAME } from "../../lib/app";
import { ARRIVALS, SLOW_WORDS, checkSignIn, signInFailure } from "../../lib/authWords";
import { startsFocused } from "../../lib/platform";
import styles from "./AuthLayout.module.css";

const NO_ERRORS = {};

/**
 * Sign in. Once the server accepts, the route this page sits in (PublicOnlyRoute) carries the visitor on:
 * to the address they first asked for, or to Today.
 *
 * Arriving here from one of the neighbouring pages can bring along (in the router's state) the email to
 * start with and a word on what has just happened: `arrival` is a key of ARRIVALS.
 */
const SignInPage = () => {
    const { login } = useAuth();
    const { state } = useLocation();
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    const [email, setEmail] = useState(state?.email ?? "");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState(NO_ERRORS);
    const [busy, setBusy] = useState(false);
    // The address of an account whose password was right but whose email is still to be confirmed
    const [unconfirmed, setUnconfirmed] = useState("");
    const slow = useSlow(busy);

    // Where the visitor was headed goes along to the neighbouring pages, so it survives a detour through them
    const onward = state?.from ? { from: state.from } : undefined;

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;

        const found = checkSignIn({ email, password });
        if (Object.keys(found).length > 0) {
            setErrors(found);
            (found.email ? emailRef : passwordRef).current?.focus();
            return;
        }

        setBusy(true);
        setUnconfirmed("");
        try {
            await login({ email: email.trim(), password });
        } catch (error) {
            const failure = signInFailure(error);

            if (failure.unconfirmed) {
                setUnconfirmed(email.trim());
            } else {
                setErrors(failure);
                // Ready to be typed again
                if (failure.password) passwordRef.current?.select();
            }
            setBusy(false);
        }
    };

    const edit = (set) => (event) => {
        set(event.target.value);
        setErrors(NO_ERRORS);
    };

    const arrival = unconfirmed ? ARRIVALS.unconfirmed : ARRIVALS[state?.arrival];

    return (
        <AuthLayout
            title="Sign in"
            lead={arrival ? <Notice>{arrival}</Notice> : null}
            neighbour={
                <span>
                    New to {APP_NAME}?{" "}
                    <Link to="/signup" state={onward} className={styles.link}>
                        Create an account
                    </Link>
                </span>
            }
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
                    autoFocus={startsFocused && !email}
                    value={email}
                    error={errors.email}
                    onChange={edit(setEmail)}
                />
                <PasswordInput
                    ref={passwordRef}
                    label="Password"
                    name="password"
                    autoComplete="current-password"
                    autoFocus={startsFocused && Boolean(email)}
                    value={password}
                    error={errors.password}
                    onChange={edit(setPassword)}
                />
                <FormError>{errors.form}</FormError>
                <div className={styles.actions}>
                    <Button type="submit" variant="primary" size="lg" loading={busy}>
                        Sign in
                    </Button>
                    <Link to="/forgot-password" state={{ ...onward, email: email.trim() }} className={styles.link}>
                        Forgot password?
                    </Link>
                </div>
                {slow && <SlowNote>{SLOW_WORDS}</SlowNote>}
            </form>
            {unconfirmed && <ResendLink key={unconfirmed} email={unconfirmed} />}
        </AuthLayout>
    );
};

export default SignInPage;
