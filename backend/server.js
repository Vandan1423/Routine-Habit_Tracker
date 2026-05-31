//Import necessary modules and configurations
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cron from "node-cron";

//Import Express Error Handler
import ExpressError from "./src/utils/ExpressError.js";

//Import functions
import connectDB from "./src/config/db.js";
import { processDailyPenalties } from "./src/utils/dailyPenaltyJob.js";

//Import routes
import authRoutes from "./src/routes/authRoutes.js";
import routineRoutes from "./src/routes/routineRoutes.js";
import habitRoutes from "./src/routes/habitRoutes.js";
import gamificationRoutes from "./src/routes/gamificationRoutes.js";
import streakRoutes from "./src/routes/streakRoutes.js";

dotenv.config();

const app = express();
connectDB();

app.use(
    cors({
        origin: "*",
        credentials: true,
    }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- BACKGROUND JOBS ---
// Runs every day at 11:59 PM (23:59)
cron.schedule(
    "59 23 * * *",
    () => {
        console.log("⏰ Running daily penalty sweep...");
        processDailyPenalties();
    },
    {
        scheduled: true,
        // CRITICAL: Set your local timezone so it runs at midnight for YOU,
        // not midnight for whatever server your database is hosted on (usually UTC).
        timezone: "Asia/Kolkata",
    },
);

// Define routes
app.get("/", (req, res) => {
    res.send("Welcome to the Life Management API");
});
app.use("/api/auth", authRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/streaks", streakRoutes);

// 404 Handler - Must be after all routes
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

//Main Error Handler - Must be at the very end
app.use((err, req, res, next) => {
    console.error("Error:", err);

    // Handle specific error types
    if (err.name === "CastError") err.statusCode = 400;
    if (err.name === "ValidationError") err.statusCode = 400;
    if (err.code === 11000) err.statusCode = 409; // MongoDB duplicate key

    const statusCode = err.statusCode || 500;
    const message = err.message || "Something went wrong";

    res.status(statusCode).json({
        success: false,
        message: message,
    });
});

app.listen(process.env.PORT || 4000, () => {
    console.log(`Server is running on port ${process.env.PORT || 4000}`);
});
