import jwt from "jsonwebtoken";
import crypto from "crypto";
import User, { PRIVATE_USER_FIELDS } from "../models/User.js";
import ExpressError from "../utils/ExpressError.js";
import sendEmail from "../utils/sendEmail.js";
import eraseAccount from "../utils/eraseAccount.js";
import {
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

// Removes sessions whose refresh token has already expired, so the list can't grow forever
const pruneExpiredSessions = (userId) =>
    User.updateOne(
        { _id: userId },
        {
            $pull: {
                refreshTokens: {
                    createdAt: { $lt: new Date(Date.now() - REFRESH_TOKEN_TTL_MS) },
                },
            },
        },
    );

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
            return res.status(400).json({ message: "User already exists" });
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
                return res.status(503).json({
                    success: false,
                    message:
                        "We couldn't send the confirmation email. Please try again in a few minutes.",
                });
            }

            // No tokens: the account can't be used until the emailed link has been clicked
            return res.status(201).json({
                success: true,
                message:
                    "Account created. Check your email for a link to confirm your address.",
                verificationRequired: true,
                email: newUser.email,
            });
        }

        newUser.emailVerified = true;

        const accessToken = newUser.generateAccessToken();
        const refreshToken = newUser.generateRefreshToken(); // Changed to singular variable name

        newUser.refreshTokens.push({
            token: refreshToken,
            createdAt: new Date(),
        });

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

        if (user && (await user.matchPassword(password))) {
            // Checked only after the password, so this answer never tells a stranger anything about the account
            if (isEmailVerificationRequired() && !user.emailVerified) {
                return res.status(403).json({
                    success: false,
                    code: "EMAIL_NOT_VERIFIED",
                    message:
                        "Please confirm your email address before signing in. Check your inbox for the link.",
                });
            }

            const accessToken = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken(); // Changed to singular variable name

            await pruneExpiredSessions(user._id);

            user.refreshTokens.push({
                token: refreshToken,
                createdAt: new Date(),
            });

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
        const result = await User.updateOne(
            { _id: req.user._id },
            {
                $pull: {
                    refreshTokens: {
                        $or: [
                            { token: refreshToken },
                            { previousToken: refreshToken },
                        ],
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
        let newRefreshToken = user.generateRefreshToken();

        // Swap the token in place, atomically, and only if it is still this session's current one.
        // Two requests carrying the same token can't both win, and other sessions are left untouched.
        const rotation = await User.updateOne(
            { _id: user._id, "refreshTokens.token": oldRefreshToken },
            {
                $set: {
                    "refreshTokens.$.token": newRefreshToken,
                    "refreshTokens.$.previousToken": oldRefreshToken,
                    "refreshTokens.$.createdAt": new Date(),
                },
            },
        );

        if (rotation.matchedCount === 0) {
            // Not the current token. If it is the one that was just replaced, then either a parallel
            // request rotated it first or the earlier response never reached the client (page reload,
            // dropped connection). Hand back the session's current token instead of ending the session.
            const latest = await User.findById(user._id).select("refreshTokens");
            const session = latest?.refreshTokens.find(
                (tokenObj) => tokenObj.previousToken === oldRefreshToken,
            );

            if (!session) {
                return res.status(401).json({
                    success: false,
                    message: "Refresh token not valid. Please login again.",
                });
            }

            newRefreshToken = session.token;
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
        const { name, trashDays } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                ...(name !== undefined ? { name } : {}),
                ...(trashDays !== undefined ? { trashDays } : {}),
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
        const here = req.cookies?.refreshToken;
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
