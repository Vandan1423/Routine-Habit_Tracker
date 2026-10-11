import PushSubscription from "../models/PushSubscription.js";
import { publicPushKey } from "../config/push.js";
import { moneyRemindersDueFor } from "../utils/moneyReminders.js";
import { pushToUser } from "../utils/reminders.js";

// The devices an account gets reminders on. Which reminders, and how early, is the account's own setting
// (reminderLead and remindHabits, PUT /api/auth/me); the job that sends them is in utils/reminders.js.

// @desc    The key a browser subscribes with: null when this server sends no push messages
// @route   GET /api/notifications/config
export const getConfig = (req, res) => {
    res.status(200).json({ publicKey: publicPushKey() });
};

// @desc    This device agrees to reminders. A device that was another account's moves to this one.
// @route   POST /api/notifications/subscriptions
export const subscribe = async (req, res, next) => {
    try {
        const { endpoint, keys } = req.body.subscription;

        await PushSubscription.findOneAndUpdate(
            { endpoint },
            { $set: { user: req.user._id, keys }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true },
        );

        res.status(201).json({ subscribed: true });
    } catch (error) {
        next(error);
    }
};

// @desc    This device no longer wants reminders
// @route   DELETE /api/notifications/subscriptions
export const unsubscribe = async (req, res, next) => {
    try {
        await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user._id });
        res.status(200).json({ subscribed: false });
    } catch (error) {
        next(error);
    }
};

// @desc    A reminder sent now, to every device of this account, to see that they arrive
// @route   POST /api/notifications/test
export const sendTest = async (req, res, next) => {
    try {
        if (!publicPushKey()) {
            return res.status(503).json({ message: "This server doesn’t send push reminders." });
        }

        const sent = await pushToUser(req.user._id, {
            title: "Reminders are on",
            body: "This is how a reminder looks when something is about to start.",
            // A tag of its own each time, so a second test is shown too
            tag: `test:${Date.now()}`,
            url: "/settings",
        });
        if (sent === 0) {
            return res.status(404).json({ message: "No device of yours has reminders turned on." });
        }

        res.status(200).json({ sent });
    } catch (error) {
        next(error);
    }
};

// @desc    The money reminders that stand right now (subscriptions due, limits running out), for the app to show
//          while it is open. The same ones, under the same keys, are pushed while it is closed.
// @route   GET /api/notifications/money
export const getMoneyReminders = async (req, res, next) => {
    try {
        res.status(200).json({ reminders: await moneyRemindersDueFor(req.user) });
    } catch (error) {
        next(error);
    }
};
