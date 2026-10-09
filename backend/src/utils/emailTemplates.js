const APP_NAME = "Nitya";

// The app's own colours (frontend/src/styles/tokens.css, the light theme). An email cannot read the
// stylesheet, so they are written out here, and every style sits on the element it applies to:
// mail apps drop <style> blocks and most of what is not inline.
const PAPER = "#faf8f4";
const INK = "#1f1d1a";
const INK_2 = "#6b665e";
const INK_3 = "#736d64";
const LINE = "#e7e3db";
const SEGMENT_EMPTY = "#dedad0";

// The app's typeface is not on the reader's machine and mail apps do not load fonts, so: the system's own
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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

const text = (color, size, line, more = "") =>
    `font-family: ${FONT}; font-size: ${size}px; line-height: ${line}px; color: ${color}; ${more}`;

// The mark beside the name: three Day Strip segments, the last one still to be filled
const segment = (color) =>
    `<td width="5" height="12" bgcolor="${color}" style="width: 5px; height: 12px; border-radius: 2px; font-size: 0; line-height: 0;">&nbsp;</td>`;
const gap = `<td width="2" style="width: 2px; font-size: 0; line-height: 0;">&nbsp;</td>`;

// The segments sit in a table of their own: in the name's row they would be stretched to its height
const brand = `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td valign="middle" style="vertical-align: middle;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>${segment(INK)}${gap}${segment(INK)}${gap}${segment(SEGMENT_EMPTY)}</tr>
                            </table>
                        </td>
                        <td valign="middle" style="vertical-align: middle; padding-left: 8px; ${text(INK, 15, 22, "font-weight: 600;")}">${APP_NAME}</td>
                    </tr>
                </table>`;

// One look for every email, plus a plain-text copy for mail apps that don't show HTML.
// Every part is given as plain text and escaped here, so something a user typed (their name) can't add markup.
// The layout is tables with inline styles, which is what mail apps agree on. It is set for light only:
// a mail app's own dark mode may still recolour it, and the ink-on-paper pairs survive that.
// validFor is left out for a link that doesn't run out.
const build = ({ subject, heading, intro, buttonLabel, url, validFor, ignoreNote }) => ({
    subject,
    html: `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${PAPER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background-color: ${PAPER};">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px;">
                    <tr>
                        <td style="padding-bottom: 36px;">${brand}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 10px; ${text(INK, 24, 30, "font-weight: 600; letter-spacing: -0.4px;")}">${escapeHtml(heading)}</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 28px; ${text(INK, 15, 24)}">${escapeHtml(intro)}</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 28px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td bgcolor="${INK}" style="border-radius: 7px; background-color: ${INK};">
                                        <a href="${escapeHtml(url)}" style="display: inline-block; padding: 11px 20px; ${text(PAPER, 15, 22, "font-weight: 600; text-decoration: none;")}">${escapeHtml(buttonLabel)}</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 6px; ${text(INK_2, 13, 20)}">${validFor ? `The link is valid for ${escapeHtml(validFor)}. ` : ""}If the button does nothing, copy this address into your browser:</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 32px; ${text(INK_2, 13, 20, "word-break: break-all;")}">${escapeHtml(url)}</td>
                    </tr>
                    <tr>
                        <td style="padding-top: 16px; border-top: 1px solid ${LINE}; ${text(INK_3, 13, 20)}">${escapeHtml(ignoreNote)}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`,
    text: [
        heading,
        "",
        intro,
        "",
        `${buttonLabel}: ${url}`,
        "",
        ...(validFor ? [`The link is valid for ${validFor}.`] : []),
        ignoreNote,
    ].join("\n"),
});

export const verificationEmail = ({ name, url }) =>
    build({
        subject: `Confirm your email for ${APP_NAME}`,
        heading: "Confirm your email",
        intro: `Hi ${name}, this is the address you gave when you signed up for ${APP_NAME}. Confirm it and your account opens.`,
        buttonLabel: "Confirm email",
        url,
        validFor: "24 hours",
        ignoreNote: `If you didn’t sign up for ${APP_NAME}, ignore this email and the account stays closed.`,
    });

export const passwordResetEmail = ({ url }) =>
    build({
        subject: `Reset your ${APP_NAME} password`,
        heading: "Choose a new password",
        intro: `Someone asked to reset the password of your ${APP_NAME} account. If that was you, choose a new one here. Every device signed in to the account will be signed out.`,
        buttonLabel: "Choose a new password",
        url,
        validFor: "15 minutes",
        ignoreNote: "If you didn’t ask for this, ignore this email and your password stays the same.",
    });

// Sent instead of a confirmation link when someone signs up with an address that already has an account.
// The page they signed up on can't say so (it would tell anyone who asked which addresses have accounts),
// so the address's owner is told here.
export const accountExistsEmail = ({ name, url }) =>
    build({
        subject: `You already have a ${APP_NAME} account`,
        heading: "You already have an account",
        intro: `Hi ${name}, someone just tried to sign up for ${APP_NAME} with this address. It already has an account, so nothing was created and nothing was changed. If that was you, sign in instead; if the password has slipped your mind, “Forgot password” on that page sets a new one.`,
        buttonLabel: "Sign in",
        url,
        ignoreNote: "If that wasn’t you, there is nothing to do. Your account is as you left it and nobody got in.",
    });
