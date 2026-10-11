import ExpenseBudget from "../models/ExpenseBudget.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import { addDays, getUserClockTime, getUserToday, timeToMinutes } from "./dateRules.js";
import { KEPT } from "./trash.js";

// Reminders about money: a subscription coming due (as many days ahead as it asks, see its reminderDays), due
// today, or gone past its day without being paid; and a spending limit passing the share it warns at, or going
// over. Each is given once (its key names the due day, or the month), and only in the daytime.

// The hours money is spoken of, in the user's own day: nobody needs a rent reminder at midnight
const DAY_STARTS = timeToMinutes("09:00");
const DAY_ENDS = timeToMinutes("21:00");
// How long after its day a subscription that was not paid is still mentioned
const OVERDUE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

// A due date is a calendar day kept at UTC midnight
const dayOf = (date) => new Date(date).toISOString().slice(0, 10);

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const money = (amount) => rupees.format(Number(amount) || 0).replace(/\.00$/, "");

const dayWords = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayName = (day) => dayWords.format(new Date(`${day}T00:00:00Z`)).replace(",", "");

const inWords = (days) => (days === 1 ? "tomorrow" : `in ${days} days`);

/**
 * The money reminders that stand on a day. Pure: works from what it is handed.
 * @param {Object} options
 * @param {String} options.today - "YYYY-MM-DD"
 * @param {Array} options.subscriptions - the active ones: { _id, name, amount, nextDueDate, reminderDays }
 * @param {Array} options.budgets - the active ones: { _id, category, monthlyLimit, alertThreshold }
 * @param {Map} options.spent - category => what this month has spent on it
 * @returns {Array} - each { key, title, body, url }
 */
export const moneyRemindersOn = ({ today, subscriptions = [], budgets = [], spent = new Map() }) => {
    const due = [];
    const month = today.slice(0, 7);

    for (const subscription of subscriptions) {
        if (!subscription.nextDueDate) continue;

        const day = dayOf(subscription.nextDueDate);
        const left = daysBetween(today, day);
        const ahead = Math.max(Number(subscription.reminderDays) || 0, 0);
        const key = (when) => `subscription:${subscription._id}:${day}:${when}`;
        const amount = money(subscription.amount);

        if (left > 0 && left <= ahead) {
            due.push({
                key: key("ahead"),
                title: `${subscription.name} is due ${inWords(left)}`,
                body: `${amount}, due ${dayName(day)}.`,
                url: "/expenses",
            });
        } else if (left === 0) {
            due.push({
                key: key("today"),
                title: `${subscription.name} is due today`,
                body: `${amount}. Mark it paid once it is.`,
                url: "/expenses",
            });
        } else if (left < 0 && left >= -OVERDUE_DAYS) {
            due.push({
                key: key("overdue"),
                title: `${subscription.name} is overdue`,
                body: `${amount} was due ${dayName(day)}, and it isn’t marked paid.`,
                url: "/expenses",
            });
        }
    }

    for (const budget of budgets) {
        const limit = Number(budget.monthlyLimit) || 0;
        if (limit <= 0) continue;

        const used = spent.get(budget.category) ?? 0;
        const share = used / limit;
        const key = (level) => `budget:${budget._id}:${month}:${level}`;

        if (used > limit) {
            due.push({
                key: key("over"),
                title: `Over the limit for ${budget.category}`,
                body: `${money(used)} spent this month, against ${money(limit)}.`,
                url: "/expenses",
            });
        } else if (share >= Number(budget.alertThreshold ?? 0.8)) {
            due.push({
                key: key("near"),
                title: `${budget.category} is at ${Math.floor(share * 100)}% of its limit`,
                body: `${money(used)} of ${money(limit)} spent this month, ${money(limit - used)} left.`,
                url: "/expenses",
            });
        }
    }

    return due;
};

/**
 * The money reminders due for one user right now: none outside the daytime, or when the account has
 * turned them off.
 * @param {Object} user - needs _id, timezone and remindMoney
 */
export const moneyRemindersDueFor = async (user, now = new Date()) => {
    if (user.remindMoney === false) return [];

    const clock = timeToMinutes(getUserClockTime(user, now));
    if (clock < DAY_STARTS || clock >= DAY_ENDS) return [];

    const today = getUserToday(user, now);
    const [subscriptions, budgets] = await Promise.all([
        ExpenseSubscription.find({
            user: user._id,
            ...KEPT,
            isActive: { $ne: false },
            // Nothing further off than any reminder can reach, nor further past than an overdue one is mentioned
            nextDueDate: {
                $gte: new Date(`${addDays(today, -OVERDUE_DAYS)}T00:00:00Z`),
                $lte: new Date(`${addDays(today, 366)}T00:00:00Z`),
            },
        }).select("name amount nextDueDate reminderDays"),
        ExpenseBudget.find({ user: user._id, isActive: { $ne: false } }).select("category monthlyLimit alertThreshold"),
    ]);

    let spent = new Map();
    if (budgets.length > 0) {
        const totals = await ExpenseTransaction.aggregate([
            {
                $match: {
                    user: user._id,
                    ...KEPT,
                    type: "expense",
                    monthKey: today.slice(0, 7),
                    category: { $in: budgets.map((budget) => budget.category) },
                },
            },
            { $group: { _id: "$category", total: { $sum: "$amount" } } },
        ]);
        spent = new Map(totals.map((entry) => [entry._id, entry.total]));
    }

    return moneyRemindersOn({ today, subscriptions, budgets, spent });
};
