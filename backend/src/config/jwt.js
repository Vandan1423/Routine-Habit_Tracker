import jwt from "jsonwebtoken";

// Utility functions for JWT token generation and verification

const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
    );
};

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new Error("Invalid Access Token");
    }
};

const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        throw new Error("Invalid Refresh Token");
    }
};

export {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};