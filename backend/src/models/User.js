import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { DEFAULT_TRASH_DAYS, TRASH_DAYS } from "../utils/trash.js";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    avatar: {
        type: String,
        default: "",
    },
    level: {
        type: Number,
        default: 1,
    },
    xp: {
        type: Number,
        default: 0,
    },
    coins: {
        type: Number,
        default: 0,
    },
    currentStreak: {
        type: Number,
        default: 0,
    },
    bestStreak: {
        type: Number,
        default: 0,
    },
    lastActiveDate: {
        type: String,
        default: "", // Stored as "YYYY-MM-DD" to track the last time they logged an action
    },
    timezone: {
        type: String,
        default: "UTC", // IANA name (e.g. "Asia/Kolkata"), reported by the client. Decides when this user's day starts and ends
    },
    timezoneUpdatedAt: {
        type: Date, // Last time the timezone changed, see TIMEZONE_CHANGE_COOLDOWN_MS
    },
    penaltiesSettledThrough: {
        type: String,
        default: "", // "YYYY-MM-DD": the last of this user's days whose missed tasks have been charged
    },
    trashDays: {
        type: Number,
        enum: TRASH_DAYS,
        default: DEFAULT_TRASH_DAYS, // How long Trash keeps what this user deletes
    },
    // One entry per device that is signed in. The refresh token itself is never kept, only its hash,
    // so a copy of the database can't be turned into working sessions (see authController.js).
    refreshTokens: [
        {
            // SHA-256 of the session's current refresh token
            token: {
                type: String,
                required: true,
            },
            // The current token's id (its "jti"). With createdAt it is enough to sign that same token again
            // for a client that never received it; without REFRESH_TOKEN_SECRET it opens nothing.
            tokenId: {
                type: String,
            },
            // SHA-256 of the token this one replaced. It stays usable until the new one is used,
            // so a refresh whose response never reached the client doesn't end the session.
            previousToken: {
                type: String,
            },
            // When the current token was issued. No TTL index here: on an array field it would delete
            // the whole user document. Expired sessions are pruned at login instead.
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    passwordResetToken: String,
    passwordResetExpiry: Date,
    emailVerified: {
        type: Boolean,
        // false only between signing up and clicking the emailed link. Accounts from before
        // confirmation existed carry no value at all, and so count as confirmed.
        default: true,
    },
    emailVerificationToken: String, // Hash of the token in the emailed link, like passwordResetToken
    emailVerificationExpiry: Date,
}, {
    timestamps: true,
});

// Middleware: Hash the password before saving to the database
userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance Method: Compare input password with the hashed password in the database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate Access Token (Short-lived, e.g., 15 minutes)
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" },
    );
};

const REFRESH_TOKEN_TTL_SECONDS = 15 * 24 * 60 * 60; // 15 days

/**
 * Signs a refresh token (long-lived, 15 days).
 * The same tokenId and issuedAt always give the same token, which is how a session's current token can be
 * handed out a second time without ever having been stored.
 * @param {String} tokenId - unique per token, even for two issued within the same second
 * @param {Date} issuedAt
 */
userSchema.methods.generateRefreshToken = function ({
    tokenId = crypto.randomUUID(),
    issuedAt = new Date(),
} = {}) {
    const iat = Math.floor(issuedAt.getTime() / 1000);

    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            iat,
            exp: iat + REFRESH_TOKEN_TTL_SECONDS,
            jti: tokenId,
        },
        process.env.REFRESH_TOKEN_SECRET,
    );
};

// Left out whenever a user is loaded to be sent back in a response
export const PRIVATE_USER_FIELDS =
    "-password -refreshTokens -passwordResetToken -passwordResetExpiry -emailVerificationToken -emailVerificationExpiry";

const User = mongoose.model("User", userSchema);

export default User;
