import cron from "node-cron";

import app from "./app.js";

//Import functions
import connectDB from "./src/config/db.js";
import { sweepEndedDays } from "./src/utils/dailyPenaltyJob.js";
import { purgeExpiredTrash } from "./src/utils/trashKinds.js";
import { sendDueReminders } from "./src/utils/reminders.js";
import { isPushConfigured } from "./src/config/push.js";
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

// Twice an hour as well, let go of whatever has been in Trash for as long as its owner chose.
// Opening Trash does the same for that one account, so a sweep that is missed costs nothing.
cron.schedule("20,50 * * * *", () => {
    purgeExpiredTrash().catch((error) => console.error("Error emptying expired Trash:", error));
});

// Every minute, the reminders that have come due: a routine about to start, habits still open.
// Only with push keys set (see src/config/push.js); without them the app shows reminders itself while it is open.
if (isPushConfigured()) {
    cron.schedule("* * * * *", () => {
        sendDueReminders();
    });
} else {
    console.warn(
        "Push reminders are off: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set " +
            "(`npx web-push generate-vapid-keys` makes a pair). The app still reminds while it is open.",
    );
}

app.listen(process.env.PORT || 4000, () => {
    console.log(`Server is running on port ${process.env.PORT || 4000}`);
});
