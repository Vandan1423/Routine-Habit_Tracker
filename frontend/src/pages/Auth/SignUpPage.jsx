import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout, { FormError, SlowNote } from "./AuthLayout";
import ResendLink from "./ResendLink";
import { Button, Input, PasswordInput } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useSlow from "../../hooks/useSlow";
import {
    CONFIRM_SENT,
    PASSWORD_HINT,
    SLOW_WORDS,
    checkSignUp,
    signUpFailure,
} from "../../lib/authWords";
import { startsFocused } from "../../lib/platform";
import styles from "./AuthLayout.module.css";

const NO_ERRORS = {};
const FIELDS = ["name", "email", "password"];

/**
 * Create an account. Where the server asks for the email to be confirmed first, the page then says where
 * the link went and waits there; where it does not, the visitor is signed in and carried on to Today
 * (by PublicOnlyRoute, as on the sign-in page), which offers a new account its first routines and habits.
 */
const SignUpPage = () => {
    const { register } = useAuth();
    const { state } = useLocation();
    const nameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [errors, setErrors] = useState(NO_ERRORS);
    const [busy, setBusy] = useState(false);
    // The address a confirmation link has been sent to, once it has
    const [sentTo, setSentTo] = useState("");
    const slow = useSlow(busy);

    const onward = state?.from ? { from: state.from } : undefined;

    const submit = async (event) => {
        event.preventDefault();
        if (busy) return;

        const found = checkSignUp(form);
        const first = FIELDS.find((field) => found[field]);
        if (first) {
            setErrors(found);
            ({ name: nameRef, email: emailRef, password: passwordRef })[first].current?.focus();
            return;
        }

        setBusy(true);
        try {
            const result = await register({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
            });

            if (result.verificationRequired) {
                setSentTo(result.email);
                setBusy(false);
            }
        } catch (error) {
            const failure = signUpFailure(error);

            setErrors(failure);
            if (failure.email) emailRef.current?.select();
            setBusy(false);
        }
    };

    const field = (name) => ({
        name,
        value: form[name],
        error: errors[name],
        onChange: (event) => {
            setForm((current) => ({ ...current, [name]: event.target.value }));
            setErrors(NO_ERRORS);
        },
    });

    const signIn = (
        <span>
            Already have an account?{" "}
            <Link to="/login" state={{ ...onward, email: sentTo || undefined }} className={styles.link}>
                Sign in
            </Link>
        </span>
    );

    if (sentTo) {
        return (
            <AuthLayout title={CONFIRM_SENT.title} lead={CONFIRM_SENT.text(sentTo)} neighbour={signIn}>
                <ResendLink email={sentTo} />
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
            title="Create your account"
            lead="Routines and habits, kept as one list for each day."
            neighbour={signIn}
        >
            <form className={styles.form} onSubmit={submit} noValidate>
                <Input
                    ref={nameRef}
                    label="Name"
                    autoComplete="name"
                    autoFocus={startsFocused}
                    {...field("name")}
                />
                <Input
                    ref={emailRef}
                    label="Email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    {...field("email")}
                />
                <PasswordInput
                    ref={passwordRef}
                    label="Password"
                    hint={PASSWORD_HINT}
                    autoComplete="new-password"
                    {...field("password")}
                />
                <FormError>{errors.form}</FormError>
                <div className={styles.actions}>
                    <Button type="submit" variant="primary" size="lg" loading={busy}>
                        Create account
                    </Button>
                </div>
                {slow && <SlowNote>{SLOW_WORDS}</SlowNote>}
            </form>
        </AuthLayout>
    );
};

export default SignUpPage;
