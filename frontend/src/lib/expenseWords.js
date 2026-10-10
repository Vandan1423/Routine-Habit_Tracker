// The words of the Expenses screen: the month in a sentence, each line of the ledger, when a subscription
// falls due, how a limit stands. Kept in one place, like the day's words in lib/dayMessage.js, so that the
// screen writes none of its own. Everything is worked out from its arguments.
//
// Money is stated plainly. Going over a limit is said once, as a figure; no word here judges it.

import { addDays, addMonths, formatDayBrief, formatDayShort, formatMonth, formatMonthName } from "./dates";
import { formatMoney } from "./money";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat();

const days = (count) => `${numberFormat.format(count)}${NBSP}${count === 1 ? "day" : "days"}`;

// ── Names ──

// The API keeps categories in title case; here they read as the rest of the interface does
const CATEGORY_LABELS = {
    "Food & Dining": "Food and dining",
    "Home & Living": "Home and living",
    "Health & Fitness": "Health and fitness",
    "Bills & Utilities": "Bills and utilities",
    "Rent/Hotel": "Rent or hotel",
};

export const categoryLabel = (category) => CATEGORY_LABELS[category] ?? category ?? "Other";

export const TYPE_LABELS = { expense: "Expense", income: "Income", transfer: "Transfer" };

export const METHOD_LABELS = {
    upi: "UPI",
    cash: "Cash",
    card: "Card",
    bank_transfer: "Bank transfer",
    other: "Something else",
};

export const FREQUENCY_LABELS = { weekly: "Every week", monthly: "Every month", yearly: "Every year" };

const PER = { weekly: "a week", monthly: "a month", yearly: "a year" };

// "₹119 a month"
export const perWords = (amount, frequency, currency) =>
    `${formatMoney(amount, currency)} ${PER[frequency] ?? PER.monthly}`;

// ── The head of the screen ──

// What the accounts hold between them, as the line over the title
export const balanceWords = ({ accounts, balance, currency }) => {
    if (accounts.length === 0) return "";

    const total = formatMoney(balance, currency);
    if (accounts.length === 1) return `${total} in ${accounts[0].name}`;
    if (accounts.length === 2) return `${total} across ${accounts[0].name} and ${accounts[1].name}`;
    return `${total} across ${numberFormat.format(accounts.length)} accounts`;
};

// "October", or "October 2025" for a month of another year
export const monthLabel = (month, today) =>
    month.slice(0, 4) === today.slice(0, 4) ? formatMonthName(month) : formatMonth(month);

/**
 * The month in a sentence: what was spent, how that compares, where most of it went, and anything
 * that is waiting to be paid.
 * @param {Object} model - from buildExpenseMonth (lib/expenses.js)
 * @returns {Object} - { lead, rest }
 */
export const monthWords = (model) => {
    const { month, today, current, currency, spent, previous, previousToDate, categories, due } = model;
    const money = (amount) => formatMoney(amount, currency);
    const before = formatMonthName(addMonths(month, -1));

    const waiting = current
        ? due.map((subscription) =>
              subscription.state === "today"
                  ? `${subscription.name} is due today.`
                  : `${subscription.name} was due ${days(-subscription.dueIn)} ago.`,
          )
        : [];

    if (spent === 0) {
        return {
            lead: current ? "Nothing spent yet this month." : `Nothing was spent in ${monthLabel(month, today)}.`,
            rest: waiting.join(" "),
        };
    }

    // The running month is set against the same stretch of the one before; a month that is over, against all of it
    const against = current ? previousToDate : previous;
    const compared = current ? `by this day in ${before}` : `in ${before}`;
    const difference = spent - (against ?? 0);
    const comparison =
        !against || against <= 0
            ? ""
            : Math.abs(difference) < 1
              ? `The same as ${compared}.`
              : `${money(Math.abs(difference))} ${difference > 0 ? "more" : "less"} than ${compared}.`;

    const top = categories[0];
    const most =
        top && categories.length > 1 ? `${categoryLabel(top.category)} took the most, ${money(top.total)}.` : "";

    return {
        lead: `${money(spent)} spent${current ? " so far" : ""}.`,
        rest: [comparison, most, ...waiting].filter(Boolean).join(" "),
    };
};

// ── The ledger ──

// The heading over a day's transactions
export const ledgerDayWords = (date, today) => {
    if (date === today) return "Today";
    if (date === addDays(today, -1)) return "Yesterday";
    return formatDayBrief(date);
};

// What a transaction is called: what was written for it, or failing that where it went or what it was
export const entryTitle = (entry) => {
    if (entry.description) return entry.description;
    if (entry.type === "transfer") return "Transfer";
    if (entry.type === "income") return "Income";
    return entry.place || categoryLabel(entry.category);
};

// The quieter line beside it: what it went on, where, and from which account
export const entryMeta = (entry) => {
    if (entry.type === "transfer") return [entry.account, entry.toAccount].filter(Boolean).join(" to ");
    if (entry.type === "income") return entry.account ? `Into ${entry.account}` : "";

    const title = entryTitle(entry);
    return [
        categoryLabel(entry.category) !== title ? categoryLabel(entry.category) : "",
        entry.place && entry.place !== title ? entry.place : "",
        entry.account,
    ]
        .filter(Boolean)
        .join(" · ");
};

// The whole of a transaction for a screen reader, which hears the row's button and nothing around it
export const entrySpoken = (entry, currency) =>
    [entryTitle(entry), formatMoney(entry.amount, currency), TYPE_LABELS[entry.type]?.toLowerCase(), entryMeta(entry)]
        .filter(Boolean)
        .join(", ");

// ── Subscriptions ──

// When a subscription falls due, as the line under its name
export const dueWords = (subscription) => {
    const { state, dueIn, due } = subscription;

    if (state === "paused") return "Paused";
    if (dueIn === null) return "";
    if (dueIn < -1) return `Due ${days(-dueIn)} ago`;
    if (dueIn === -1) return "Due yesterday";
    if (dueIn === 0) return "Due today";
    if (dueIn === 1) return "Due tomorrow";
    if (dueIn <= 14) return `Due in ${days(dueIn)}`;
    return `Due ${formatDayShort(due)}`;
};

export const subscribedWords = (model) =>
    model.subscribed > 0 ? `${formatMoney(Math.round(model.subscribed), model.currency)} a month` : "";

// ── Limits ──

// How a limit stands: what is left of it, or how far past it the month has gone
export const limitWords = (limit, currency) =>
    limit.left >= 0
        ? `${formatMoney(limit.left, currency)} left`
        : `${formatMoney(-limit.left, currency)} over`;

export const limitSpoken = (limit, currency) =>
    `${categoryLabel(limit.category)}: ${formatMoney(limit.spent, currency)} of ${formatMoney(limit.limit, currency)}, ${limitWords(limit, currency)}`;

// ── Said after something is done ──

// "moved" is for one whose date was changed to a day in another month
export const SAVED_WORDS = {
    expense: { made: "Expense added", moved: "Expense moved", gone: "Expense moved to Trash" },
    income: { made: "Income added", moved: "Income moved", gone: "Income moved to Trash" },
    transfer: { made: "Transfer added", moved: "Transfer moved", gone: "Transfer moved to Trash" },
};

// A transaction that was on the page for a moment and that the server then would not take
export const REFUSED_WORDS = {
    expense: { made: "The expense wasn’t added", changed: "The expense wasn’t changed" },
    income: { made: "The income wasn’t added", changed: "The income wasn’t changed" },
    transfer: { made: "The transfer wasn’t added", changed: "The transfer wasn’t changed" },
};

export const paidWords = (subscription, nextDue) => ({
    message: `${subscription.name} paid`,
    detail: `Next due ${formatDayShort(nextDue)}`,
});

// ── With nothing to show ──

export const NOTHING_LOGGED = {
    title: "Nothing has been logged yet",
    body: "Log what you spend as it happens. Each month then reads as one figure, where it went, and what is left of any limit you set.",
};

export const nothingInMonth = (month, today) => `Nothing was logged in ${monthLabel(month, today)}.`;

// The server said no (its own words are used), or could not be reached
export const failureWords = (error, fallback = "It couldn’t be saved. Check your connection and try again.") =>
    error?.cause?.response ? error.message : fallback;
