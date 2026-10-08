const APP_NAME = "Life Tracker";

const escapeHtml = (value) =>
    String(value).replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character],
    );

// One look for every email, plus a plain-text copy for mail apps that don't show HTML.
// Every part is given as plain text and escaped here, so something a user typed (their name) can't add markup.
const build = ({ subject, heading, intro, buttonLabel, url, validFor, ignoreNote }) => ({
    subject,
    html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
            <h2 style="color: #0f5b3f;">${escapeHtml(heading)}</h2>
            <p>${escapeHtml(intro)}</p>
            <p style="margin: 24px 0;">
                <a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 24px; background-color: #1f9b6c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">${escapeHtml(buttonLabel)}</a>
            </p>
            <p>Or copy this link into your browser:<br>${escapeHtml(url)}</p>
            <p>The link is valid for ${escapeHtml(validFor)}.</p>
            <p style="color: #666666; font-size: 13px;">${escapeHtml(ignoreNote)}</p>
        </div>
    `,
    text: [
        heading,
        "",
        intro,
        "",
        `${buttonLabel}: ${url}`,
        "",
        `The link is valid for ${validFor}.`,
        ignoreNote,
    ].join("\n"),
});

export const verificationEmail = ({ name, url }) =>
    build({
        subject: `Confirm your email for ${APP_NAME}`,
        heading: "Confirm your email",
        intro: `Hi ${name}, thanks for signing up for ${APP_NAME}. Confirm that this is your email address to start using your account.`,
        buttonLabel: "Confirm Email",
        url,
        validFor: "24 hours",
        ignoreNote: `If you didn't sign up for ${APP_NAME}, ignore this email and the account will stay closed.`,
    });

export const passwordResetEmail = ({ url }) =>
    build({
        subject: `Reset your ${APP_NAME} password`,
        heading: "Password Reset Request",
        intro: "You requested a password reset. Use the button below to choose a new password.",
        buttonLabel: "Reset Password",
        url,
        validFor: "15 minutes",
        ignoreNote: "If you didn't request this, ignore this email and your password stays the same.",
    });
