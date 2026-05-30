import { verifyAccessToken } from "../config/jwt.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    try {
        let accessToken;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            accessToken = req.headers.authorization.split(" ")[1];
        }

        if (!accessToken) {
            return res
                .status(401)
                .json({ message: "Not authorized, no token", success: false });
        }

        // Verify token and extract payload
        const payload = verifyAccessToken(accessToken);

        if (!payload) {
            return res.status(401).json({
                message: "Not authorized, Invalid or expired token",
                success: false,
            });
        }

        // Find user by ID from payload
        const user = await User.findById(payload._id);
        if (!user) {
            return res.status(401).json({
                message: "User not found, Invalid token",
                success: false,
            });
        }

        req.user = user; // Attach user to request object
        next(); // Proceed to next middleware or route handler
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        return res.status(401).json({
            success: false,
            message: "Not authorized. Authentication failed.",
        });
    }
};
