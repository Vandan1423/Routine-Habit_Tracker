import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ExpressError from "../utils/ExpressError.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
};

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res
                .status(400)
                .json({ message: "Please fill all the fields" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const newUser = new User({
            name,
            email,
            password,
        });

        const accessToken = newUser.generateAccessToken();
        const refreshToken = newUser.generateRefreshToken(); // Changed to singular variable name

        newUser.refreshTokens.push({
            token: refreshToken,
            createdAt: new Date(),
        });

        await newUser.save({ validateBeforeSave: false });

        const safeUser = await User.findById(newUser._id).select(
            "-password -refreshTokens",
        );

        res.status(201)
            .cookie("refreshToken", refreshToken, cookieOptions) // Standardized to "refreshToken"
            .json({
                message: "User registered successfully",
                user: safeUser,
                accessToken,
            });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Please fill all the fields" });
        }

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            const accessToken = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken(); // Changed to singular variable name

            user.refreshTokens.push({
                token: refreshToken,
                createdAt: new Date(),
            });

            await user.save({ validateBeforeSave: false });

            const safeUser = await User.findById(user._id).select(
                "-password -refreshTokens",
            );

            return res
                .status(200)
                .cookie("refreshToken", refreshToken, cookieOptions) // Standardized to "refreshToken"
                .json({
                    message: "User logged in successfully",
                    user: safeUser,
                    accessToken,
                });
        } else {
            return res.status(400).json({ message: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const logoutUser = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "No refresh token found.",
            });
        }

        // Using req.user._id assuming this route uses the 'protect' middleware!
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        user.refreshTokens = user.refreshTokens.filter(
            (rt) => rt.token !== refreshToken,
        );

        await user.save({ validateBeforeSave: false });

        res.clearCookie("refreshToken", cookieOptions).status(200).json({
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

        res.clearCookie("refreshToken", cookieOptions).status(200).json({
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
        const oldRefreshToken =
            req.cookies?.refreshToken || req.body?.refreshToken;

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

        const tokenIndex = user.refreshTokens.findIndex(
            (tokenObj) => tokenObj.token === oldRefreshToken,
        );

        if (tokenIndex === -1) {
            return res.status(401).json({
                success: false,
                message: "Refresh token not valid. Please login again.",
            });
        }

        // FIXED: Using your User instance methods instead of jwtConfig
        const newAccessToken = user.generateAccessToken();
        const newRefreshToken = user.generateRefreshToken();

        const updatedRefreshTokens = user.refreshTokens.filter(
            (tokenObj) => tokenObj.token !== oldRefreshToken,
        );

        updatedRefreshTokens.push({
            token: newRefreshToken,
            createdAt: new Date(),
        });

        await User.findByIdAndUpdate(
            user._id,
            { refreshTokens: updatedRefreshTokens },
            { returnDocument: "after" },
        );

        res.cookie("refreshToken", newRefreshToken, cookieOptions); // FIXED: Using standard cookieOptions

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
