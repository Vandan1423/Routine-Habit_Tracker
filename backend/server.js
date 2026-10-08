import cron from "node-cron";

import app from "./app.js";

//Import functions
import connectDB from "./src/config/db.js";
import { sweepEndedDays } from "./src/utils/dailyPenaltyJob.js";
import { isEmailVerificationRequired } from "./src/controllers/authController.js";
import { usesTestSender } from "./src/utils/sendEmail.js";

connectDB();

if (isEmailVerificationRequired() && usesTestSender()) {
    console.warn(
        "Emails go out from Resend's test sender, which only delivers to the Resend account's own address. " +
            "Nobody else can finish signing up until emails are sent through a Gmail account (the GMAIL_ settings, " +
            "see scripts/gmailToken.js), or EMAIL_FROM is an address on a domain verified in Resend, " +
            "or EMAIL_VERIFICATION_REQUIRED is set to false.",
    );
}

// --- BACKGROUND JOBS ---
// Twice an hour, close the day for every user whose midnight has just passed
// (timezones sit on the hour or the half hour, so this is at most a few minutes late for nearly everyone).
// It doesn't have to run: a user's own next request settles their days as well.
cron.schedule("5,35 * * * *", () => {
    sweepEndedDays();
});

app.listen(process.env.PORT || 4000, () => {
    console.log(`Server is running on port ${process.env.PORT || 4000}`);
});
