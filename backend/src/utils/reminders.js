import User from "../models/User.js";
import PushSubscription from "../models/PushSubscription.js";
import ReminderLog from "../models/ReminderLog.js";
import { isPushConfigured, sendPush } from "../config/push.js";
import { getUserClockTime, getUserToday, timeToMinutes } from "./dateRules.js";
import { readDay } from "./dayPlan.js";
import { DEFAULT_REMINDER_LEAD, REMINDER_LEADS } from "./reminderLeads.js";

// Reminders: a nudge before each routine (and one-off task) that is still to do today, and one for the habits
// of each part of the day that are still open. Worked out from the same reading of the day that charges for
// misses (readDay), so nothing paused, retired or deleted is ever reminded of.
// Sent by Web Push to every device the account has agreed on (config/push.js); the app itself shows the same
// reminders while it is open, under the same tags, so a device that gets both shows one.

export { DEFAULT_REMINDER_LEAD, REMINDER_LEADS };

// A reminder that "starts now" stays worth sending this long after its moment; one ahead of a start, until it starts
const AT_START_WINDOW = 5;

// When the habits of each part of the day are nudged about, if any of them is still open, and for how long after
const HABIT_NUDGES = { morning: "08:00", afternoon: "13:00", evening: "18:00", anytime: "20:00" };
const HABIT_WINDOW = 60;
const HABIT_HEADINGS = {
    morning: "This morning’s habits",
    afternoon: "This afternoon’s habits",
    evening: "This evening’s habits",
    anytime: "Still open today",
};

const listOf = (titles) =>
    titles.length <= 3 ? titles.join(", ") : `${titles.slice(0, 3).join(", ")} and ${titles.length - 3} more`;

const minutesWords = (minutes) =>
    minutes >= 60 && minutes % 60 === 0
        ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}`
        : `${minutes} minute${minutes === 1 ? "" : "s"}`;

/**
 * The reminders due at one moment of a user's day. Pure: works from the day as readDay reads it.
 * @param {Object} options
 * @param {String} options.today - "YYYY-MM-DD"
 * @param {Number} options.clock - minutes since the user's midnight
 * @param {Object} options.day - from readDay: routines, habits, doneRoutineIds, doneHabitIds
 * @param {Number} [options.lead] - minutes before a routine starts
 * @param {Boolean} [options.habits] - whether open habits are nudged about
 * @returns {Array} - each { key, title, body, url }: key is the reminder's own, and its tag on the device
 */
export const remindersAt = ({ today, clock, day, lead = DEFAULT_REMINDER_LEAD, habits = true }) => {
    const due = [];

    // Something deleted or retired today may still count for today (see countsOn), but is not reminded of
    for (const routine of day.routines) {
        if (!routine.isActive || day.doneRoutineIds.has(routine._id.toString())) continue;

        const start = timeToMinutes(routine.startTime);
        if (start === null || Number.isNaN(start)) continue;

        const at = start - lead;
        const until = lead === 0 ? start + AT_START_WINDOW : start;
        if (clock < at || clock >= until) continue;

        const left = start - clock;
        due.push({
            key: `routine:${routine._id}:${today}`,
            title: routine.title,
            body: left > 0 ? `Starts in ${minutesWords(left)}.` : "Starting now.",
            url: "/today",
        });
    }

    if (habits) {
        for (const [block, time] of Object.entries(HABIT_NUDGES)) {
            const at = timeToMinutes(time);
            if (clock < at || clock >= at + HABIT_WINDOW) continue;

            const open = day.habits.filter(
                (habit) =>
                    habit.isActive &&
                    (habit.timeOfDay ?? "anytime") === block &&
                    !day.doneHabitIds.has(habit._id.toString()),
            );
            if (open.length === 0) continue;

            due.push({
                key: `habits:${block}:${today}`,
                title: HABIT_HEADINGS[block],
                body: listOf(open.map((habit) => habit.title)),
                url: "/today",
            });
        }
    }

    return due;
};

/**
 * The reminders due for one user right now, as their own day stands.
 * @param {Object} user - needs _id, timezone, reminderLead and remindHabits
 */
export const remindersDueFor = async (user, now = new Date()) => {
    const today = getUserToday(user, now);
    const clock = timeToMinutes(getUserClockTime(user, now));
    const day = await readDay(user, today);

    return remindersAt({
        today,
        clock,
        day,
        lead: user.reminderLead ?? DEFAULT_REMINDER_LEAD,
        habits: user.remindHabits ?? true,
    });
};

/**
 * Sends one message to every device a user has agreed on, dropping the devices that have since said no.
 * @returns {Number} - how many devices it went to
 */
export const pushToUser = async (userId, payload, send = sendPush) => {
    const subscriptions = await PushSubscription.find({ user: userId });
    let sent = 0;

    for (const subscription of subscriptions) {
        try {
            const outcome = await send(subscription, payload);
            if (outcome === "gone") {
                await PushSubscription.deleteOne({ _id: subscription._id });
            } else {
                sent += 1;
            }
        } catch (error) {
            console.error(`Push to a device of user ${userId} failed:`, error.message);
        }
    }
    return sent;
};

const isDuplicateKey = (error) => error?.code === 11000;

/**
 * The job: sends every reminder that is due, to everyone with a device to send it to, each one once.
 * Missing a run (the server was asleep) only loses reminders whose moment passed meanwhile; none is sent late.
 * @param {Object} [options] - now; send: how one message is sent (tests pass their own)
 * @returns {Number} - how many reminders went out
 */
export const sendDueReminders = async ({ now = new Date(), send = sendPush } = {}) => {
    if (send === sendPush && !isPushConfigured()) return 0;

    let sent = 0;
    try {
        const userIds = await PushSubscription.distinct("user");
        const users = await User.find({ _id: { $in: userIds } }).select("timezone reminderLead remindHabits");

        for (const user of users) {
            try {
                for (const reminder of await remindersDueFor(user, now)) {
                    // Claimed before it is sent, so two runs at once can't both send it
                    try {
                        await ReminderLog.create({ user: user._id, key: reminder.key });
                    } catch (error) {
                        if (isDuplicateKey(error)) continue;
                        throw error;
                    }

                    const { key, ...message } = reminder;
                    await pushToUser(user._id, { ...message, tag: key }, send);
                    sent += 1;
                }
            } catch (error) {
                console.error(`Reminders failed for user ${user._id}:`, error);
            }
        }
    } catch (error) {
        console.error("Error sending reminders:", error);
    }
    return sent;
};
