import { useEffect, useSyncExternalStore } from "react";
import useAuth from "../../hooks/useAuth";
import useToday from "../../hooks/useToday";
import { remindersOnHere, showReminder, subscribeReminders, syncPush } from "../../lib/notify";
import { DEFAULT_REMINDER_LEAD, remindersAhead } from "../../lib/reminders";
import notificationService from "../../services/notificationService";

// Reminders further off than this are set when the day comes round again
const LOOK_AHEAD_MS = 24 * 60 * 60 * 1000;
// How often money is asked about while the app is open (the server says what is due, and when it is daytime)
const MONEY_EVERY_MS = 15 * 60 * 1000;

/**
 * Shows today's reminders while the app is open, on a device where they are turned on (Settings): before each
 * routine still to do (and before it ends, if asked), for the habits still open in each part of the day, and
 * for money that is due. Draws nothing.
 * The server pushes the same reminders under the same keys while the app is closed; a device shows each once.
 */
const Reminders = () => {
    const { user } = useAuth();
    const today = useToday();
    const on = useSyncExternalStore(subscribeReminders, remindersOnHere, () => false);

    const { status, date, routines, habits, ensure } = today;
    const userId = user?._id ?? user?.id ?? null;
    const lead = user?.reminderLead ?? DEFAULT_REMINDER_LEAD;
    const endLead = user?.endReminderLead ?? null;
    const habitsOn = user?.remindHabits ?? true;
    const moneyOn = user?.remindMoney ?? true;

    // The day has to be known to be reminded of, whichever screen is open
    useEffect(() => {
        if (on) ensure();
    }, [on, ensure]);

    // Once per account signed in here: make sure the server can reach this device while the app is closed
    useEffect(() => {
        if (on && userId) syncPush().catch(() => {});
    }, [on, userId]);

    useEffect(() => {
        if (!on || status !== "ready") return undefined;

        const now = new Date();
        const timers = remindersAhead({ date, routines, habits, now, lead, endLead, habitsOn })
            .filter((reminder) => reminder.at - now < LOOK_AHEAD_MS)
            .map((reminder) =>
                setTimeout(() => showReminder(reminder).catch(() => {}), Math.max(reminder.at - now, 0)),
            );

        return () => timers.forEach(clearTimeout);
    }, [on, status, date, routines, habits, lead, endLead, habitsOn]);

    // Money: subscriptions coming due, spending limits running out. Asked for now, every so often, and
    // whenever the app is looked at again.
    useEffect(() => {
        if (!on || !moneyOn || !userId) return undefined;

        const ask = () =>
            notificationService
                .money()
                .then(({ reminders }) => Promise.all(reminders.map((reminder) => showReminder(reminder))))
                .catch(() => {});
        const onVisible = () => {
            if (document.visibilityState === "visible") ask();
        };

        ask();
        const timer = setInterval(ask, MONEY_EVERY_MS);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [on, moneyOn, userId]);

    return null;
};

export default Reminders;
