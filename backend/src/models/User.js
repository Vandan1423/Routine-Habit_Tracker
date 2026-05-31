import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
    refreshTokens: [
        {
            token: {
                type: String,
                required: true,
            },
            createdAt: {
                type: Date,
                default: Date.now,
                expires: 15 * 24 * 60 * 60 * 1000, // 15 days
            },
        },
    ],
    passwordResetToken: String,
    passwordResetExpiry: Date,
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

// Generate Refresh Token (Long-lived, e.g., 7 days)
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "15d" },
    );
};

const User = mongoose.model("User", userSchema);

export default User;
