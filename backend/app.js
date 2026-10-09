//Import necessary modules and configurations
import "dotenv/config"; // First, so every module below sees the environment
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";

//Import Express Error Handler
import ExpressError from "./src/utils/ExpressError.js";

//Import routes
import authRoutes from "./src/routes/authRoutes.js";
import routineRoutes from "./src/routes/routineRoutes.js";
import habitRoutes from "./src/routes/habitRoutes.js";
import gamificationRoutes from "./src/routes/gamificationRoutes.js";
import streakRoutes from "./src/routes/streakRoutes.js";
import historyRoutes from "./src/routes/historyRoutes.js";
import expenseRoutes from "./src/routes/expenseRoutes.js";
import todoRoutes from "./src/routes/todoRoutes.js";
import goalRoutes from "./src/routes/goalRoutes.js";
import trashRoutes from "./src/routes/trashRoutes.js";

// The Express app on its own: no database connection, no background jobs, no port.
// server.js adds those to run it for real; the tests import this file and run it against a test database.
const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Define routes
app.get("/", (req, res) => {
    res.send("Welcome to the Life Management API");
});
app.use("/api/auth", authRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/streaks", streakRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/trash", trashRoutes);

// 404 Handler - Must be after all routes
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

//Main Error Handler - Must be at the very end
app.use((err, req, res, next) => {
    let statusCode = 500;
    let message = "Something went wrong. Please try again.";

    // Handle specific error types
    if (err instanceof ExpressError) {
        // Raised on purpose by our own code, so the message is safe to show
        statusCode = err.statusCode;
        message = err.message;
    } else if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid ${err.path}.`;
    } else if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((el) => el.message)
            .join(", ");
    } else if (err.code === 11000) {
        statusCode = 409; // MongoDB duplicate key
        message = "This has already been saved.";
    } else if (err.type === "entity.parse.failed") {
        statusCode = 400;
        message = "The request body is not valid JSON.";
    } else if (err.type === "entity.too.large") {
        statusCode = 413;
        message = "The request is too large.";
    }

    // Anything unexpected is logged here in full; the client only ever gets the generic message
    if (statusCode >= 500) {
        console.error("Error:", err);
    }

    res.status(statusCode).json({
        success: false,
        message: message,
    });
});

export default app;
