// The money side of the app, worked out from what the API sends: one month laid out for the Expenses screen,
// and the forms a transaction, a subscription and a limit are made and changed in.
// No React here, so the rules can be read (and checked) on their own. The words are in lib/expenseWords.js.

import { addDays, addMonths, lastDayOf, monthOf } from "./dates";
import { DEFAULT_CURRENCY, MOST_MONEY, readMoney, writeMoney } from "./money";

// As the API keeps them. How each is written on screen is in lib/expenseWords.js.
export const CATEGORIES = [
    "Food & Dining",
    "Travel",
    "Shopping",
    "Home & Living",
    "Health & Fitness",
    "Education",
    "Bills & Utilities",
    "Entertainment",
    "Rent/Hotel",
    "Gifts",
    "Other",
];

export const TYPES = ["expense", "income", "transfer"];
export const PAYMENT_METHODS = ["upi", "cash", "card", "bank_transfer", "other"];
export const FREQUENCIES = ["weekly", "monthly", "yearly"];

// How many named places the month's picture shows before the rest are added together
const PLACES_SHOWN = 5;

// A subscription is "soon" when it falls due within this many days
const SOON_DAYS = 7;

const UNCATEGORISED = "Other";

// The server writes "Other" for a place that was left empty
const isNamed = (place) => Boolean(place) && place.trim().toLowerCase() !== "other";

const idOf = (reference) => (reference && typeof reference === "object" ? reference._id : reference) ?? "";

// A date from the API ("2026-10-08T00:00:00.000Z") is a calendar day kept at UTC midnight
export const dayOfDate = (value) => String(value ?? "").slice(0, 10);

// ── One month ──

const entryOf = (transaction) => ({
    id: transaction._id,
    type: transaction.type,
    amount: Number(transaction.amount) || 0,
    date: dayOfDate(transaction.transactionDate),
    category: transaction.category || UNCATEGORISED,
    description: (transaction.description ?? "").trim(),
    place: isNamed(transaction.placeName) ? transaction.placeName.trim() : "",
    account: transaction.account?.name ?? "",
    toAccount: transaction.transferToAccount?.name ?? "",
    source: transaction,
});

// The list of transactions is read this many at a time
export const PAGE_SIZE = 100;

// Pages of the list as one list, each transaction once, in the order first met. (Something logged between
// two reads moves every line after it along by one, and a line can then turn up on two pages.)
export const joinPages = (...pages) => {
    const seen = new Set();

    return pages.flat().filter((transaction) => !seen.has(transaction._id) && seen.add(transaction._id));
};

// The transactions under the day each belongs to, newest day first, with what each day spent.
// The server says what a day spent (`spentByDay`, a Map by date): with the list read a page at a time, the
// lines of the last day here may not all have come yet. Added up from the lines only where it has not said.
const groupByDay = (entries, spentByDay = new Map()) => {
    const days = [];

    for (const entry of entries) {
        let day = days.at(-1);
        if (!day || day.date !== entry.date) {
            day = { date: entry.date, entries: [], spent: 0 };
            days.push(day);
        }
        day.entries.push(entry);
        if (entry.type === "expense") day.spent += entry.amount;
    }

    return days.map((day) => ({ ...day, spent: spentByDay.get(day.date) ?? day.spent }));
};

// "ok", "near" (past the share the limit warns at) or "over"
const limitStatus = (spent, budget) => {
    const limit = Number(budget.monthlyLimit) || 0;
    if (limit <= 0) return spent > 0 ? "over" : "ok";
    if (spent > limit) return "over";
    return spent / limit >= Number(budget.alertThreshold ?? 0.8) ? "near" : "ok";
};

const STATUS_ORDER = { over: 0, near: 1, ok: 2 };

/**
 * When a subscription next falls due after `day`: a week, a month or a year on. A month or a year on from
 * the 31st lands on the last day of a shorter month.
 * @param {String} day - "YYYY-MM-DD"
 */
export const nextDueDay = (day, frequency) => {
    if (frequency === "weekly") return addDays(day, 7);

    const month = addMonths(monthOf(day), frequency === "yearly" ? 12 : 1);
    const wanted = `${month}-${day.slice(8)}`;
    const last = lastDayOf(month);

    return wanted > last ? last : wanted;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

// What a subscription comes to in a month, whatever it is paid by
const PER_MONTH = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };

const subscriptionOf = (subscription, today) => {
    const due = dayOfDate(subscription.nextDueDate);
    const dueIn = due && today ? daysBetween(today, due) : null;
    const active = subscription.isActive !== false;

    return {
        id: subscription._id,
        name: subscription.name,
        amount: Number(subscription.amount) || 0,
        frequency: subscription.frequency ?? "monthly",
        category: subscription.category || UNCATEGORISED,
        due,
        dueIn,
        active,
        // "paused", "late", "today", "soon" or "later"
        state: !active
            ? "paused"
            : dueIn === null
              ? "later"
              : dueIn < 0
                ? "late"
                : dueIn === 0
                  ? "today"
                  : dueIn <= SOON_DAYS
                    ? "soon"
                    : "later",
        source: subscription,
    };
};

/**
 * One month of money, laid out for the screen.
 * @param {Object} summary - GET /expenses/summary for the month
 * @param {Object[]} transactions - GET /expenses/transactions for the month, newest first: the pages read so far
 * @param {Number} [total] - how many transactions the month has in all; the ones given, unless said
 * @param {Set} [hidden] - ids of transactions and subscriptions on their way out, already gone from the page
 */
export const buildExpenseMonth = ({ summary, transactions = [], total, hidden = new Set() }) => {
    const today = summary.today ?? "";
    const month = summary.month ?? monthOf(today);
    const accounts = (summary.accounts ?? []).map((account) => ({
        id: account._id,
        name: account.name,
        type: account.type,
        balance: Number(account.currentBalance) || 0,
        opening: Number(account.openingBalance) || 0,
        source: account,
    }));
    const currency = summary.accounts?.[0]?.currency || DEFAULT_CURRENCY;

    const entries = transactions.filter((transaction) => !hidden.has(transaction._id)).map(entryOf);
    const count = Math.max(total ?? 0, entries.length);
    const spentByDay = new Map((summary.monthDays ?? []).map((day) => [day.date, Number(day.spent) || 0]));
    const spent = Number(summary.monthExpensesTotal) || 0;

    const categories = (summary.categoryTotals ?? []).map(({ category, total }) => ({
        category,
        total,
        share: spent > 0 ? total / spent : 0,
    }));
    const spentOn = new Map(categories.map(({ category, total }) => [category, total]));

    const limits = (summary.budgets ?? [])
        .filter((budget) => budget.isActive !== false)
        .map((budget) => {
            const used = spentOn.get(budget.category) ?? 0;
            const limit = Number(budget.monthlyLimit) || 0;

            return {
                category: budget.category,
                spent: used,
                limit,
                left: limit - used,
                status: limitStatus(used, budget),
                source: budget,
            };
        })
        .sort(
            (a, b) =>
                STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
                b.spent / (b.limit || 1) - a.spent / (a.limit || 1) ||
                a.category.localeCompare(b.category),
        );
    const limited = new Set(limits.map((limit) => limit.category));

    // The places with a name, largest first; whatever was spent beyond them, or nowhere in particular, as one
    const named = (summary.monthPlaceTotals ?? []).filter((place) => isNamed(place.name));
    const shown = named.slice(0, PLACES_SHOWN);
    const elsewhere = spent - shown.reduce((sum, place) => sum + place.total, 0);
    const places = shown.map((place) => ({
        name: place.name,
        total: place.total,
        count: place.count,
        share: spent > 0 ? place.total / spent : 0,
    }));
    if (places.length > 0 && elsewhere > 0.005) {
        places.push({ name: null, total: elsewhere, count: null, share: elsewhere / spent });
    }

    const subscriptions = (summary.subscriptions ?? [])
        .filter((subscription) => !hidden.has(subscription._id))
        .map((subscription) => subscriptionOf(subscription, today))
        // What is running first, soonest due at the top; what is paused after
        .sort((a, b) => Number(b.active) - Number(a.active) || a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
    const running = subscriptions.filter((subscription) => subscription.active);

    return {
        today,
        month,
        current: month === monthOf(today),
        currency,
        firstMonth: summary.firstMonth ?? null,
        lastMonth: summary.lastMonth ?? null,

        spent,
        income: Number(summary.monthIncomeTotal) || 0,
        previous: Number(summary.previousMonthExpensesTotal) || 0,
        // What had been spent by this day of the month before; null for a month that is over
        previousToDate: summary.previousMonthToDate ?? null,

        accounts,
        balance: accounts.reduce((sum, account) => sum + account.balance, 0),

        // The lines read so far, and how many the month has in all
        entries,
        count,
        days: groupByDay(entries, spentByDay),
        categories,
        limits,
        // The categories a limit can still be set for
        unlimited: CATEGORIES.filter((category) => !limited.has(category)),
        places,
        series: (summary.monthSeries ?? []).map((point) => ({
            month: point.monthKey,
            total: Number(point.total) || 0,
            shown: point.monthKey === month,
        })),

        subscriptions,
        // What the running subscriptions come to in a month
        subscribed: running.reduce((sum, subscription) => sum + subscription.amount * (PER_MONTH[subscription.frequency] ?? 1), 0),
        // The ones that want attention now: past due, or due today
        due: running.filter((subscription) => subscription.state === "late" || subscription.state === "today"),

        suggestedPlaces: (summary.suggestedPlaces ?? []).filter(isNamed),
        // Nothing has ever been logged, as against nothing in this month
        untouched: (summary.firstMonth ?? null) === null && entries.length === 0,
    };
};

/**
 * The months the screen can turn to: from the first with anything in it to the one today is in
 * (or a later one, if something has been dated ahead).
 * @returns {Object} - { first, last }, both "YYYY-MM"
 */
export const monthBounds = ({ today, firstMonth, lastMonth }) => {
    const current = monthOf(today);

    return {
        first: firstMonth && firstMonth < current ? firstMonth : current,
        last: lastMonth && lastMonth > current ? lastMonth : current,
    };
};

// What an account's opening balance has to be for its balance now to read `wanted`
export const openingFor = (account, wanted) => Math.round((account.opening + (wanted - account.balance)) * 100) / 100;

// ── The form a transaction is made and changed in ──

// How money usually leaves an account of this kind
const usualMethod = (account) => (account?.type === "cash" ? "cash" : "upi");

/**
 * A new transaction's form.
 * @param {Object} start - today: the day it starts out on; accounts: from buildExpenseMonth; type: "expense" unless given
 */
export const emptyTransaction = ({ today = "", accounts = [], type = "expense" } = {}) => ({
    type,
    amount: "",
    accountId: accounts[0]?.id ?? "",
    toAccountId: accounts[1]?.id ?? "",
    category: CATEGORIES[0],
    description: "",
    place: "",
    date: today,
    method: usualMethod(accounts[0]),
    notes: "",
});

// The form of a transaction that exists, as the API sent it
export const transactionFormOf = (transaction, { accounts = [] } = {}) => {
    const accountId = idOf(transaction.account);

    return {
        type: transaction.type ?? "expense",
        amount: writeMoney(transaction.amount),
        accountId,
        toAccountId: idOf(transaction.transferToAccount) || (accounts.find((account) => account.id !== accountId)?.id ?? ""),
        category: transaction.category || UNCATEGORISED,
        description: transaction.description ?? "",
        place: isNamed(transaction.placeName) ? transaction.placeName : "",
        date: dayOfDate(transaction.transactionDate),
        method: transaction.paymentMethod ?? "other",
        notes: transaction.notes ?? "",
    };
};

// The form after another account is chosen: how it was paid follows the account, unless that was set by hand
export const withAccount = (form, accountId, accounts) => {
    const was = accounts.find((account) => account.id === form.accountId);
    const next = accounts.find((account) => account.id === accountId);
    const followed = form.method === usualMethod(was);

    return {
        ...form,
        accountId,
        method: followed ? usualMethod(next) : form.method,
        // A transfer cannot go to the account it leaves
        toAccountId:
            form.toAccountId === accountId
                ? (accounts.find((account) => account.id !== accountId)?.id ?? "")
                : form.toAccountId,
    };
};

const amountError = (text) => {
    const amount = readMoney(text);
    if (!(amount > 0)) return "Enter an amount above zero.";
    if (amount > MOST_MONEY) return "That is more than can be kept here.";
    return undefined;
};

// What is wrong with a transaction's form, by field. Empty when it can be saved.
export const validateTransaction = (form) => {
    const errors = {};

    const amount = amountError(form.amount);
    if (amount) errors.amount = amount;
    if (!form.accountId) errors.accountId = "Choose an account.";
    if (!form.date) errors.date = "Choose a day.";
    if (form.type === "transfer" && (!form.toAccountId || form.toAccountId === form.accountId)) {
        errors.toAccountId = "Choose the account it goes to.";
    }

    return errors;
};

// What is sent to the API for a form that has passed validateTransaction
export const transactionPayload = (form) => {
    const spent = form.type === "expense";

    return {
        type: form.type,
        amount: readMoney(form.amount),
        accountId: form.accountId,
        transferToAccountId: form.type === "transfer" ? form.toAccountId : null,
        // Only spending has somewhere it went and something it went on
        category: spent ? form.category : UNCATEGORISED,
        placeName: spent ? form.place.trim() : "",
        description: form.description.trim(),
        paymentMethod: form.method,
        transactionDate: form.date,
        notes: form.notes.trim(),
    };
};

// ── The form a subscription is made and changed in ──

export const emptySubscription = ({ today = "", accounts = [] } = {}) => ({
    name: "",
    amount: "",
    frequency: "monthly",
    due: today,
    accountId: accounts[0]?.id ?? "",
    category: "Bills & Utilities",
    description: "",
});

export const subscriptionFormOf = (subscription) => ({
    name: subscription.name ?? "",
    amount: writeMoney(subscription.amount),
    frequency: subscription.frequency ?? "monthly",
    due: dayOfDate(subscription.nextDueDate),
    accountId: idOf(subscription.account),
    category: subscription.category || UNCATEGORISED,
    description: subscription.description ?? "",
});

export const validateSubscription = (form) => {
    const errors = {};

    if (!form.name.trim()) errors.name = "Give it a name.";
    const amount = amountError(form.amount);
    if (amount) errors.amount = amount;
    if (!form.accountId) errors.accountId = "Choose an account.";
    if (!form.due) errors.due = "Choose a day.";

    return errors;
};

export const subscriptionPayload = (form) => ({
    name: form.name.trim(),
    amount: readMoney(form.amount),
    frequency: form.frequency,
    nextDueDate: form.due,
    accountId: form.accountId,
    category: form.category,
    description: form.description.trim(),
});

/**
 * Paying a subscription: the expense that is logged for it, and the day it falls due after that.
 * @param {Object} subscription - from buildExpenseMonth
 * @param {String} today - "YYYY-MM-DD", the day the payment is logged on
 * @param {Object[]} accounts - from buildExpenseMonth
 */
export const paymentOf = (subscription, today, accounts = []) => {
    const accountId = idOf(subscription.source.account);

    return {
        transaction: {
            type: "expense",
            amount: subscription.amount,
            accountId,
            category: subscription.category,
            description: subscription.name,
            placeName: "",
            paymentMethod: accounts.find((account) => account.id === accountId)?.type === "cash" ? "cash" : "other",
            transactionDate: today,
            subscriptionId: subscription.id,
        },
        nextDue: nextDueDay(subscription.due || today, subscription.frequency),
    };
};

// ── A limit on a category ──

export const validateLimit = ({ category, amount }) => {
    const errors = {};

    if (!category) errors.category = "Choose what it is a limit on.";
    const wrong = amountError(amount);
    if (wrong) errors.amount = wrong;

    return errors;
};

// Sent to set a limit, or to change one. The share it warns at stays as it was.
export const limitPayload = ({ category, amount }, existing = null) => ({
    category,
    monthlyLimit: readMoney(amount),
    alertThreshold: existing?.alertThreshold ?? 0.8,
    isActive: true,
});

// Sent to take a limit away. What it was is kept, so setting one again starts from it.
export const removedLimit = (budget) => ({
    category: budget.category,
    monthlyLimit: budget.monthlyLimit,
    alertThreshold: budget.alertThreshold ?? 0.8,
    isActive: false,
});

// True when two forms hold the same answers (so closing one loses nothing)
export const sameAnswers = (a, b) => Object.keys(a).every((key) => a[key] === b[key]);
