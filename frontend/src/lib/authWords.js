// The pages a visitor sees before signing in: what is checked before a form is sent, and how what the
// server answers is said. No React here, so the rules can be read (and checked) on their own.

// The limits the server holds a new account to (AuthSchema.js). What the server says is still what counts.
export const SHORTEST_PASSWORD = 6;
const LONGEST_PASSWORD = 128;
const SHORTEST_NAME = 2;
const LONGEST_NAME = 50;

export const PASSWORD_HINT = `At least ${SHORTEST_PASSWORD} characters.`;

// The links the server emails carry a token of this shape; anything else was cut short or mistyped
const TOKEN = /^[0-9a-f]{64}$/i;
export const isLinkToken = (token) => TOKEN.test(token ?? "");

// Loose on purpose: the server has the last word on what an address is
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const emailError = (email) => {
    if (!email.trim()) return "Enter your email.";
    return looksLikeEmail(email.trim()) ? null : "That doesn’t look like an email address.";
};

const newPasswordError = (password) => {
    if (password.length < SHORTEST_PASSWORD) return `Use at least ${SHORTEST_PASSWORD} characters.`;
    return password.length > LONGEST_PASSWORD ? `Use at most ${LONGEST_PASSWORD} characters.` : null;
};

// Each check answers with what is wrong, by field. Empty when the form can be sent.
const found = (errors) =>
    Object.fromEntries(Object.entries(errors).filter(([, message]) => message));

export const checkSignIn = ({ email, password }) =>
    found({
        email: emailError(email),
        password: password ? null : "Enter your password.",
    });

export const checkSignUp = ({ name, email, password }) => {
    const trimmed = name.trim();

    return found({
        name:
            trimmed.length < SHORTEST_NAME
                ? "Enter your name."
                : trimmed.length > LONGEST_NAME
                  ? `Use at most ${LONGEST_NAME} characters.`
                  : null,
        email: emailError(email),
        password: newPasswordError(password),
    });
};

export const checkEmail = ({ email }) => found({ email: emailError(email) });

export const checkNewPassword = ({ password }) => found({ password: newPasswordError(password) });

// ── What went wrong, as the form should say it: { field: message }, with `form` for what belongs to no field ──

const UNREACHABLE = "The server couldn’t be reached. Check your connection and try again.";

// How long a limit lasts is only in the server's sentence: an hour for emails, a quarter of an hour otherwise
const waitWords = (error) =>
    /hour/i.test(error.message ?? "")
        ? "Too many requests for this address. Try again in an hour."
        : "Too many attempts. Try again in 15 minutes.";

// Anything every form can meet: no answer at all, or a limit reached
const commonFailure = (error) => {
    if (!error.status) return { form: UNREACHABLE };
    if (error.status === 429) return { form: waitWords(error) };
    return null;
};

const WRONG_SIGN_IN =
    "That email and password don’t match. If you’ve just signed up, open the link in your email first.";

/**
 * A sign-in that was refused.
 * @returns {Object} - errors by field; or `{ unconfirmed: true }` when the password was right
 *   but the account's email has not been confirmed yet
 */
export const signInFailure = (error) => {
    if (error.code === "EMAIL_NOT_VERIFIED") return { unconfirmed: true };

    const common = commonFailure(error);
    if (common) return common;

    // The server does not say which of the two was wrong, and neither does this. It answers the same way for
    // a right password on an account whose email is still to be confirmed, so everyone is told about the link.
    if (error.status === 400 && /invalid credentials/i.test(error.message)) {
        return { password: WRONG_SIGN_IN };
    }
    return { form: error.message };
};

export const signUpFailure = (error) => {
    const common = commonFailure(error);
    if (common) return common;

    if (/already exists/i.test(error.message ?? "")) {
        return { email: "That address already has an account. Sign in instead." };
    }
    return { form: error.message };
};

// Sending a link (to confirm an address, or to reset a password), and saving a new password
export const requestFailure = (error) => commonFailure(error) ?? { form: error.message };

// ── What a page says once something has been sent ──

export const CONFIRM_SENT = {
    title: "Confirm your email",
    text: (email) => `We sent a link to ${email}. Open it to finish, then sign in. It works for 24 hours.`,
    again: (email) => `Another link is on its way to ${email}. Only the newest one works.`,
};

export const RESET_SENT = {
    title: "Check your email",
    text: (email) =>
        `If ${email} has an account, a link to choose a new password is on its way. It works for 15 minutes.`,
};

// Said on the sign-in page to someone who arrives from one of the others
export const ARRIVALS = {
    reset: "Your password is changed. Sign in with the new one.",
    confirmed: "Your email is confirmed. Sign in to begin.",
    unconfirmed: "This account’s email hasn’t been confirmed yet. Open the link we sent, then sign in.",
};

// A first request can find the server asleep (see Waking in components/shell)
export const SLOW_WORDS = "The server is waking up. The first request after a rest takes about half a minute.";
