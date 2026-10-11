import jwt from "jsonwebtoken";
import crypto from "crypto";
import User, { PRIVATE_USER_FIELDS } from "../models/User.js";
import PushSubscription from "../models/PushSubscription.js";
import ExpressError from "../utils/ExpressError.js";
import sendEmail from "../utils/sendEmail.js";
import eraseAccount from "../utils/eraseAccount.js";
import {
    accountExistsEmail,
    passwordResetEmail,
    verificationEmail,
} from "../utils/emailTemplates.js";
import {
    addDays,
    DEFAULT_TIMEZONE,
    getTodayIn,
    isValidTimezone,
} from "../utils/dateRules.js";

const REFRESH_TOKEN_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Signing in to an unconfirmed account sends its link again, but not while the last one is this new:
// at most 3 an hour, the same as asking for it on purpose (see verificationEmailRateLimit)
const EMAIL_VERIFICATION_RESEND_MS = 20 * 60 * 1000; // 20 minutes
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

// New accounts must confirm their email before they can be used, unless EMAIL_VERIFICATION_REQUIRED is "false".
// The switch is for a deployment that can't send email to its users yet; read per request, like the cookie options.
export const isEmailVerificationRequired = () =>
    process.env.EMAIL_VERIFICATION_REQUIRED !== "false";

const hashToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");

// The token for an emailed link. Only its hash is stored, so a copy of the database can't be turned into working links.
const createEmailToken = () => {
    const raw = crypto.randomBytes(32).toString("hex");
    return { raw, hashed: hashToken(raw) };
};

// Puts a fresh confirmation link on the account, replacing any earlier one, and returns the email carrying it.
// The caller saves the user and sends the email.
const startEmailVerification = (user) => {
    const token = createEmailToken();
    user.emailVerified = false;
    user.emailVerificationToken = token.hashed;
    user.emailVerificationExpiry = Date.now() + EMAIL_VERIFICATION_TTL_MS;

    return {
        to: user.email,
        ...verificationEmail({
            name: user.name,
            url: `${process.env.CLIENT_URL}/verify-email/${token.raw}`,
        }),
    };
};

// Built per request, so it doesn't rely on .env already being loaded when this module is imported
const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "None" : "Lax",
        maxAge: REFRESH_TOKEN_TTL_MS,
    };
};

/**
 * A new session for a device that has just signed in.
 * @returns {Object} - refreshToken: for the cookie, and nowhere else. session: what the account keeps of it,
 *   which is its hash. A copy of the database can't be turned into working sessions.
 */
const openSession = (user) => {
    const tokenId = crypto.randomUUID();
    const createdAt = new Date();
    const refreshToken = user.generateRefreshToken({ tokenId, issuedAt: createdAt });

    return {
        refreshToken,
        session: { token: hashToken(refreshToken), tokenId, createdAt },
    };
};

// Removes sessions whose refresh token has already expired, so the list can't grow forever.
// Those from before tokens were hashed (they have no tokenId) go too: they can no longer be used.
const pruneExpiredSessions = (userId) =>
    User.updateOne(
        { _id: userId },
        {
            $pull: {
                refreshTokens: {
                    $or: [
                        { createdAt: { $lt: new Date(Date.now() - REFRESH_TOKEN_TTL_MS) } },
                        { tokenId: { $exists: false } },
                    ],
                },
            },
        },
    );

// What a sign-up is told when confirmation is on. An address that already has an account gets the very same
// answer as a new one, word for word, so neither says which of the two it was.
const signUpAnswer = (email) => ({
    success: true,
    message: "Account created. Check your email for a link to confirm your address.",
    verificationRequired: true,
    email,
});

const EMAIL_NOT_SENT = {
    success: false,
    message: "We couldn't send the confirmation email. Please try again in a few minutes.",
};

export const registerUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res
                .status(400)
                .json({ message: "Please fill all the fields" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser?.emailVerified) {
            // With confirmation switched off, a sign-up is answered with a session, and there is none to give
            // for somebody else's account: here the answer can't help saying that the address is taken.
            if (!isEmailVerificationRequired()) {
                return res.status(400).json({ message: "User already exists" });
            }

            // Otherwise the answer is the one a new address gets, so signing up can't be used to find out
            // who has an account. The account is left exactly as it was, and its owner is told by email.
            // Checking the password costs what hashing a new one does, so the two answers take as long.
            await existingUser.matchPassword(password);

            try {
                await sendEmail({
                    to: existingUser.email,
                    ...accountExistsEmail({
                        name: existingUser.name,
                        url: `${process.env.CLIENT_URL}/login`,
                    }),
                });
            } catch (error) {
                console.error("Account notice email failed:", error.message);
                return res.status(503).json(EMAIL_NOT_SENT);
            }

            return res.status(201).json(signUpAnswer(existingUser.email));
        }

        // A new account starts in the timezone its client reports
        const reportedTimezone = req.headers["x-timezone"];
        const hasTimezone = isValidTimezone(reportedTimezone);
        const timezone = hasTimezone ? reportedTimezone : DEFAULT_TIMEZONE;

        // An account whose email was never confirmed has never been usable, and whoever opened it never
        // showed the address was theirs. Signing up for it again starts it over instead of being refused.
        const newUser = existingUser ?? new User({ email });

        newUser.set({
            name,
            password,
            timezone,
            timezoneUpdatedAt: hasTimezone ? new Date() : undefined,
            // Missed-task penalties count from the day the account is created
            penaltiesSettledThrough: addDays(getTodayIn(timezone), -1),
            refreshTokens: [],
        });

        if (isEmailVerificationRequired()) {
            const confirmation = startEmailVerification(newUser);
            await newUser.save({ validateBeforeSave: false });

            try {
                await sendEmail(confirmation);
            } catch (error) {
                // The account stays unconfirmed, so signing up again later simply tries once more
                console.error("Confirmation email failed:", error.message);
                return res.status(503).json(EMAIL_NOT_SENT);
            }

            // No tokens: the account can't be used until the emailed link has been clicked
            return res.status(201).json(signUpAnswer(newUser.email));
        }

        newUser.emailVerified = true;

        const accessToken = newUser.generateAccessToken();
        const { refreshToken, session } = openSession(newUser);

        newUser.refreshTokens.push(session);

        await newUser.save({ validateBeforeSave: false });

        const safeUser = await User.findById(newUser._id).select(
            PRIVATE_USER_FIELDS,
        );

        res.status(201)
            .cookie("refreshToken", refreshToken, getCookieOptions()) // Standardized to "refreshToken"
            .json({
                message: "User registered successfully",
                user: safeUser,
                accessToken,
            });
    } catch (error) {
        next(error);
    }
};

export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Please fill all the fields" });
        }

        const user = await User.findOne({ email });
        // An address with no account has its password checked all the same, so that answer takes as long
        const passwordMatches = user
            ? await user.matchPassword(password)
            : await User.checkAgainstNothing(password);

        if (user && passwordMatches) {
            // Answered exactly like a wrong password, so signing up and then signing in can't be used to tell
            // that an address has an account. The owner is told by email instead: a fresh confirmation link.
            if (isEmailVerificationRequired() && !user.emailVerified) {
                // Only once the last link is a while old. One sent a moment ago is still good, a new one would
                // end it, and without this the 5 tries an account gets could each put an email in its inbox.
                const lastLinkSentAt = (user.emailVerificationExpiry?.getTime() ?? 0) - EMAIL_VERIFICATION_TTL_MS;

                if (Date.now() - lastLinkSentAt >= EMAIL_VERIFICATION_RESEND_MS) {
                    const confirmation = startEmailVerification(user);
                    await user.save({ validateBeforeSave: false });

                    // Not awaited, so this answer arrives as fast as a wrong password does
                    sendEmail(confirmation).catch((error) =>
                        console.error("Confirmation email failed:", error.message),
                    );
                }

                return res.status(400).json({ message: "Invalid credentials" });
            }

            const accessToken = user.generateAccessToken();
            const { refreshToken, session } = openSession(user);

            await pruneExpiredSessions(user._id);

            user.refreshTokens.push(session);

            await user.save({ validateBeforeSave: false });

            const safeUser = await User.findById(user._id).select(
                PRIVATE_USER_FIELDS,
            );

            return res
                .status(200)
                .cookie("refreshToken", refreshToken, getCookieOptions()) // Standardized to "refreshToken"
                .json({
                    message: "User logged in successfully",
                    user: safeUser,
                    accessToken,
                });
        } else {
            return res.status(400).json({ message: "Invalid credentials" });
        }
    } catch (error) {
        next(error);
    }
};

export const logoutUser = async (req, res) => {
    try {
        // The refresh token only ever travels in its HttpOnly cookie, out of reach of page scripts
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "No refresh token found.",
            });
        }

        // Using req.user._id assuming this route uses the 'protect' middleware!
        // $pull only touches this session, so a refresh happening on another device isn't overwritten.
        // previousToken is matched too, in case the client never received its latest rotation.
        const held = hashToken(refreshToken);
        const result = await User.updateOne(
            { _id: req.user._id },
            {
                $pull: {
                    refreshTokens: {
                        $or: [{ token: held }, { previousToken: held }],
                    },
                },
            },
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        res.clearCookie("refreshToken", getCookieOptions()).status(200).json({
            success: true,
            message: "Logged out successfully.",
        });
    } catch (error) {
        console.error("Logout error:", error.message);
        throw new ExpressError(500, "Failed to logout.");
    }
};

export const logoutAll = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        // Wipe the array to log out everywhere
        user.refreshTokens = [];
        await user.save({ validateBeforeSave: false });
        // A device that is signed out gets no reminders; each one asks again once it is signed back in
        await PushSubscription.deleteMany({ user: user._id });

        res.clearCookie("refreshToken", getCookieOptions()).status(200).json({
            success: true,
            message: "Logged out from all devices successfully.",
        });
    } catch (error) {
        console.error("Logout all error:", error.message);
        throw new ExpressError(500, "Failed to logout from all devices.");
    }
};

export const refreshAccessToken = async (req, res) => {
    try {
        const oldRefreshToken = req.cookies?.refreshToken;

        if (!oldRefreshToken) {
            return res.status(401).json({
                success: false,
                message: "No refresh token provided.",
            });
        }

        let payload;
        try {
            // FIXED: Replaced jwtConfig with standard jwt.verify
            payload = jwt.verify(
                oldRefreshToken,
                process.env.REFRESH_TOKEN_SECRET,
            );
        } catch (error) {
            console.error("Token verification error:", error.message);
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token.",
            });
        }

        // Use payload._id to match what was signed in the User model
        const user = await User.findById(payload._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found.",
            });
        }

        // FIXED: Using your User instance methods instead of jwtConfig
        const newAccessToken = user.generateAccessToken();
        const held = hashToken(oldRefreshToken);
        const next = openSession(user);
        let newRefreshToken = next.refreshToken;

        // Swap the token in place, atomically, and only if it is still this session's current one.
        // Two requests carrying the same token can't both win, and other sessions are left untouched.
        const rotation = await User.updateOne(
            { _id: user._id, "refreshTokens.token": held },
            {
                $set: {
                    "refreshTokens.$.token": next.session.token,
                    "refreshTokens.$.tokenId": next.session.tokenId,
                    "refreshTokens.$.previousToken": held,
                    "refreshTokens.$.createdAt": next.session.createdAt,
                },
            },
        );

        if (rotation.matchedCount === 0) {
            // Not the current token. If it is the one that was just replaced, then either a parallel
            // request rotated it first or the earlier response never reached the client (page reload,
            // dropped connection). Hand back the session's current token instead of ending the session.
            // Only its hash is kept, so it is signed again from its id and the moment it was issued.
            const latest = await User.findById(user._id).select("refreshTokens");
            const session = latest?.refreshTokens.find(
                (tokenObj) => tokenObj.previousToken === held,
            );
            const current =
                session?.tokenId &&
                user.generateRefreshToken({
                    tokenId: session.tokenId,
                    issuedAt: session.createdAt,
                });

            if (!current || hashToken(current) !== session.token) {
                return res.status(401).json({
                    success: false,
                    message: "Refresh token not valid. Please login again.",
                });
            }

            newRefreshToken = current;
        }

        res.cookie("refreshToken", newRefreshToken, getCookieOptions()); // FIXED: Using standard cookieOptions

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully.",
            accessToken: newAccessToken,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Refresh token error:", error.message);
        return res
            .status(500)
            .json({ success: false, message: "Failed to refresh token." });
    }
};

export const getMe = async (req, res) => {
    res.status(200).json({
        user: req.user,
    });
};

// PUT /api/auth/me
// What an account's owner may change here: the name it goes by, and how long Trash keeps what they delete
export const updateProfile = async (req, res, next) => {
    try {
        const { name, trashDays, reminderLead, endReminderLead, remindHabits, remindMoney } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                ...(name !== undefined ? { name } : {}),
                ...(trashDays !== undefined ? { trashDays } : {}),
                ...(reminderLead !== undefined ? { reminderLead } : {}),
                ...(endReminderLead !== undefined ? { endReminderLead } : {}),
                ...(remindHabits !== undefined ? { remindHabits } : {}),
                ...(remindMoney !== undefined ? { remindMoney } : {}),
            },
            { returnDocument: "after" },
        ).select(PRIVATE_USER_FIELDS);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        next(error);
    }
};

// A wrong password is answered with 400, never 401: to a client, 401 means "your session has run out"
const wrongPassword = (res) =>
    res.status(400).json({
        success: false,
        code: "WRONG_PASSWORD",
        message: "That isn't your current password.",
    });

// PUT /api/auth/password
// Changes the password and signs out every other device. The one that asked stays signed in.
export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (!user || !(await user.matchPassword(currentPassword))) {
            return wrongPassword(res);
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({
                success: false,
                message: "The new password is the same as the current one.",
            });
        }

        user.password = newPassword; // hashed by the model as it is saved
        // A reset link asked for under the old password is finished too
        user.passwordResetToken = undefined;
        user.passwordResetExpiry = undefined;
        await user.save({ validateBeforeSave: false });

        // Sessions are removed in one operation of their own, so a refresh happening meanwhile isn't overwritten.
        // previousToken is matched too, in case this client never received its latest rotation.
        const here = req.cookies?.refreshToken && hashToken(req.cookies.refreshToken);
        await User.updateOne(
            { _id: user._id },
            here
                ? {
                      $pull: {
                          refreshTokens: {
                              token: { $ne: here },
                              previousToken: { $ne: here },
                          },
                      },
                  }
                : { $set: { refreshTokens: [] } },
        );

        res.status(200).json({
            success: true,
            message: "Password changed. Your other devices have been signed out.",
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/delete-account
// Removes the account and everything in it, for good. The password is asked for again first.
export const deleteAccount = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !(await user.matchPassword(req.body.password))) {
            return wrongPassword(res);
        }

        await eraseAccount(user._id);

        res.clearCookie("refreshToken", getCookieOptions()).status(200).json({
            success: true,
            message: "Your account has been deleted.",
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/verify-email/:token
export const verifyEmail = async (req, res, next) => {
    try {
        const invalid = {
            success: false,
            message: "This confirmation link is invalid or has expired.",
        };

        const user = await User.findOne({
            emailVerificationToken: hashToken(req.params.token),
        });

        if (!user) {
            return res.status(400).json(invalid);
        }

        // The token is kept after it has been used, so opening the link a second time
        // (a double click, a mail app that opens links by itself) still gets a friendly answer
        if (!user.emailVerified) {
            if (!(user.emailVerificationExpiry > Date.now())) {
                return res.status(400).json(invalid);
            }

            await User.updateOne(
                { _id: user._id },
                {
                    $set: { emailVerified: true },
                    $unset: { emailVerificationExpiry: "" },
                },
            );
        }

        res.status(200).json({
            success: true,
            message: "Email confirmed. You can sign in now.",
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        // Same answer whether the address has an account, is already confirmed, or is still waiting
        if (user && !user.emailVerified) {
            const confirmation = startEmailVerification(user);
            await user.save({ validateBeforeSave: false });

            // Not awaited, so the answer doesn't arrive later for an address that is waiting than for one that isn't
            sendEmail(confirmation).catch((error) =>
                console.error("Confirmation email failed:", error.message),
            );
        }

        res.status(200).json({
            success: true,
            message:
                "If that account is waiting to be confirmed, a new link has been sent.",
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        // Always return 200 — don't reveal if email exists or not
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If that email exists, a reset link has been sent.",
            });
        }

        // Generate raw token, store hashed version in DB
        const token = createEmailToken();

        user.passwordResetToken = token.hashed;
        user.passwordResetExpiry = Date.now() + PASSWORD_RESET_TTL_MS;
        await user.save({ validateBeforeSave: false });

        const resetURL = `${process.env.CLIENT_URL}/reset-password/${token.raw}`;

        // Not awaited, and a failure is only logged: the answer must be the same, and arrive
        // just as fast, for an address that has an account as for one that doesn't
        sendEmail({
            to: user.email,
            ...passwordResetEmail({ url: resetURL }),
        }).catch((error) =>
            console.error("Password reset email failed:", error.message),
        );

        res.status(200).json({
            success: true,
            message: "If that email exists, a reset link has been sent.",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// POST /api/auth/reset-password/:token
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required.",
            });
        }

        const user = await User.findOne({
            passwordResetToken: hashToken(token), // Hash the incoming token to compare with DB
            passwordResetExpiry: { $gt: Date.now() }, // not expired
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token.",
            });
        }

        user.password = password; // your User model should hash it in pre-save hook
        user.passwordResetToken = undefined;
        user.passwordResetExpiry = undefined;
        user.emailVerified = true; // the reset link arrived by email too, so the address is confirmed
        user.refreshTokens = []; // log out all devices after password change
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password reset successfully. Please login again.",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
