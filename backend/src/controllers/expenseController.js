import ExpenseAccount from "../models/ExpenseAccount.js";
import ExpenseBudget from "../models/ExpenseBudget.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import KnownSpendPlace from "../models/KnownSpendPlace.js";
import { getUserToday } from "../utils/dateRules.js";
import { KEPT, trashStamp } from "../utils/trash.js";

const CATEGORIES = [
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

const PAYMENT_METHODS = ["upi", "cash", "card", "bank_transfer", "other"];

const ensureDefaultAccounts = async (userId) => {
    const existing = await ExpenseAccount.find({ user: userId }).sort({ sortOrder: 1, createdAt: 1 });
    if (existing.length > 0) {
        return existing;
    }

    await ExpenseAccount.create([
        {
            user: userId,
            name: "Bank",
            type: "bank",
            openingBalance: 0,
            sortOrder: 0,
        },
        {
            user: userId,
            name: "Cash",
            type: "cash",
            openingBalance: 0,
            sortOrder: 1,
        },
    ]);

    return ExpenseAccount.find({ user: userId }).sort({ sortOrder: 1, createdAt: 1 });
};

// "2026-10" for a user whose today is "2026-10-08"
const getUserMonthKey = (user) => getUserToday(user).slice(0, 7);

// shiftMonth("2026-01", -1) is "2025-12"
const shiftMonth = (monthKey, offset) => {
    const [year, month] = monthKey.split("-").map(Number);
    const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

const getReadableMonth = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
};

const normalizePlaceName = (value = "") => value.trim().toLowerCase().replace(/\s+/g, " ");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Accounts and subscriptions referenced by a request must belong to the user making it
const ownsAccount = (userId, accountId) => ExpenseAccount.exists({ _id: accountId, user: userId });
const ownsSubscription = (userId, subscriptionId) => ExpenseSubscription.exists({ _id: subscriptionId, user: userId, ...KEPT });

// How many transactions the list hands over at a time, unless fewer are asked for
const PAGE_SIZE = 100;

// Every figure below is added up by the database. However long an account's ledger grows, a request
// brings back a handful of totals and at most one page of transactions, never the ledger itself.

const sumAmount = { $sum: "$amount" };

// A place or a category left empty counts as "Other"
const named = (value) => value || "Other";

/**
 * What each account holds: its opening balance, with everything that went in or out since.
 * @returns {Map} - account id (as text) => balance
 */
const readBalances = async (userId, accounts) => {
    const moved = await ExpenseTransaction.aggregate([
        { $match: { user: userId, ...KEPT } },
        {
            $group: {
                _id: { account: "$account", to: "$transferToAccount", type: "$type" },
                total: sumAmount,
            },
        },
    ]);

    const balances = new Map(
        accounts.map((account) => [account._id.toString(), Number(account.openingBalance || 0)]),
    );
    const add = (accountId, amount) => {
        if (!accountId) return;
        const key = accountId.toString();
        balances.set(key, (balances.get(key) || 0) + amount);
    };

    for (const { _id: movement, total } of moved) {
        if (movement.type === "expense") add(movement.account, -total);
        if (movement.type === "income") add(movement.account, total);
        if (movement.type === "transfer") {
            add(movement.account, -total);
            add(movement.to, total);
        }
    }

    return balances;
};

const withBalances = (accounts, balances) =>
    accounts.map((account) => ({
        ...account.toObject(),
        currentBalance: balances.get(account._id.toString()) || 0,
    }));

// Rows of { _id: name, total, count } as a list by name, largest first. Names that count as one are added together.
const totalsByName = (rows) => {
    const totals = new Map();

    for (const { _id, total, count } of rows) {
        const name = named(_id);
        const held = totals.get(name) ?? { name, total: 0, count: 0 };
        held.total += total;
        held.count += count;
        totals.set(name, held);
    }

    return [...totals.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

/**
 * Everything the Expenses screen shows for one month, apart from the accounts and the list of transactions.
 * @param {String} today - the user's own today, "YYYY-MM-DD"
 * @param {String} month - the month on show, "YYYY-MM". The month today is in unless another was asked for.
 */
const readSummary = async (userId, today, month) => {
    const currentMonthKey = today.slice(0, 7);
    const previousMonthKey = shiftMonth(currentMonthKey, -1);
    const seriesMonths = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
    const months = [...new Set([currentMonthKey, previousMonthKey, ...seriesMonths])];
    const expensesOfMonth = { type: "expense", monthKey: month };

    const [[ledger], [figures]] = await Promise.all([
        // One pass over the whole ledger: how far it reaches, and where it was spent
        ExpenseTransaction.aggregate([
            { $match: { user: userId, ...KEPT } },
            {
                $facet: {
                    // Months are written "YYYY-MM", so they sort as text
                    span: [
                        { $match: { monthKey: { $gt: "" } } },
                        { $group: { _id: null, first: { $min: "$monthKey" }, last: { $max: "$monthKey" } } },
                    ],
                    places: [
                        { $match: { type: "expense" } },
                        { $group: { _id: "$placeName", total: sumAmount, count: { $sum: 1 } } },
                    ],
                },
            },
        ]),
        // The months the screen has figures for: the one on show with the five before it, this one and the last
        ExpenseTransaction.aggregate([
            { $match: { user: userId, ...KEPT, monthKey: { $in: months } } },
            {
                $facet: {
                    categories: [
                        { $match: { type: "expense" } },
                        {
                            $group: {
                                _id: { month: "$monthKey", category: "$category" },
                                total: sumAmount,
                                count: { $sum: 1 },
                            },
                        },
                    ],
                    places: [
                        { $match: expensesOfMonth },
                        { $group: { _id: "$placeName", total: sumAmount, count: { $sum: 1 } } },
                    ],
                    // A transaction's date is a calendar day kept at UTC midnight
                    days: [
                        { $match: expensesOfMonth },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" } },
                                spent: sumAmount,
                            },
                        },
                        { $sort: { _id: -1 } },
                    ],
                    income: [
                        { $match: { type: "income", monthKey: month } },
                        { $group: { _id: null, total: sumAmount } },
                    ],
                    // The same stretch of the month before: on the 9th, what had been spent by the 9th of last month
                    toDate: [
                        {
                            $match: {
                                type: "expense",
                                monthKey: previousMonthKey,
                                $expr: { $lte: [{ $dayOfMonth: "$transactionDate" }, Number(today.slice(8))] },
                            },
                        },
                        { $group: { _id: null, total: sumAmount } },
                    ],
                },
            },
        ]),
    ]);

    // monthKey => { total, count, categories: Map(category => total) }
    const byMonth = new Map();
    for (const { _id, total, count } of figures.categories) {
        const held = byMonth.get(_id.month) ?? { total: 0, count: 0, categories: new Map() };
        const category = named(_id.category);

        held.total += total;
        held.count += count;
        held.categories.set(category, (held.categories.get(category) || 0) + total);
        byMonth.set(_id.month, held);
    }

    const totalOf = (monthKey) => byMonth.get(monthKey)?.total ?? 0;
    const countOf = (monthKey) => byMonth.get(monthKey)?.count ?? 0;
    // A month's categories, largest first
    const categoriesOf = (monthKey) =>
        [...(byMonth.get(monthKey)?.categories ?? [])]
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

    return {
        today,
        currentMonthKey,
        currentMonthExpensesTotal: totalOf(currentMonthKey),
        lastMonthExpensesTotal: totalOf(previousMonthKey),
        currentMonthExpenseCount: countOf(currentMonthKey),
        // The month on show, and how far the months with anything in them reach
        month,
        firstMonth: ledger.span[0]?.first ?? null,
        lastMonth: ledger.span[0]?.last ?? null,
        monthExpensesTotal: totalOf(month),
        monthExpenseCount: countOf(month),
        monthIncomeTotal: figures.income[0]?.total ?? 0,
        previousMonthExpensesTotal: totalOf(shiftMonth(month, -1)),
        // Only said of the month that is still running
        previousMonthToDate: month === currentMonthKey ? (figures.toDate[0]?.total ?? 0) : null,
        monthSeries: seriesMonths.map((monthKey) => {
            const top = categoriesOf(monthKey)[0] ?? { category: "Other", total: 0 };

            return {
                monthKey,
                label: getReadableMonth(monthKey),
                total: totalOf(monthKey),
                topCategory: top.category,
                topCategoryTotal: top.total,
            };
        }),
        categoryTotals: categoriesOf(month),
        placeTotals: totalsByName(ledger.places),
        monthPlaceTotals: totalsByName(figures.places),
        // What each day of the month on show spent, newest first. The list of transactions comes a page at a
        // time, so a day's lines may not all be there to be added up.
        monthDays: figures.days.map(({ _id, spent }) => ({ date: _id, spent })),
        categoryBudgets: {},
    };
};

const populated = (query) => query.populate("account", "name type").populate("transferToAccount", "name type");

// The newest day first, and within a day the one logged last
const NEWEST_FIRST = { transactionDate: -1, createdAt: -1, _id: -1 };

export const getSummary = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const accounts = await ensureDefaultAccounts(userId);
        const today = getUserToday(req.user);

        const [summary, balances, recentTransactions, subscriptions, places, budgets] = await Promise.all([
            readSummary(userId, today, req.query.month || today.slice(0, 7)),
            readBalances(userId, accounts),
            populated(ExpenseTransaction.find({ user: userId, ...KEPT })).sort(NEWEST_FIRST).limit(16),
            ExpenseSubscription.find({ user: userId, ...KEPT }).sort({ isActive: -1, nextDueDate: 1 }),
            KnownSpendPlace.find({ user: userId }).sort({ transactionCount: -1, lastVisitedAt: -1 }),
            ExpenseBudget.find({ user: userId, isActive: true }),
        ]);

        res.status(200).json({
            accounts: withBalances(accounts, balances),
            ...summary,
            recentTransactions,
            subscriptions,
            suggestedPlaces: places.map((place) => place.name).sort((a, b) => a.localeCompare(b)),
            budgets,
        });
    } catch (error) {
        next(error);
    }
};

export const getAccounts = async (req, res, next) => {
    try {
        const accounts = await ensureDefaultAccounts(req.user._id);
        const balances = await readBalances(req.user._id, accounts);

        res.status(200).json({ accounts: withBalances(accounts, balances) });
    } catch (error) {
        next(error);
    }
};

export const updateAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, openingBalance } = req.body;

        const account = await ExpenseAccount.findOneAndUpdate(
            { _id: id, user: req.user._id },
            {
                ...(name !== undefined ? { name } : {}),
                ...(openingBalance !== undefined ? { openingBalance: Number(openingBalance) } : {}),
            },
            { new: true, runValidators: true },
        );

        if (!account) {
            return res.status(404).json({ message: "Account not found" });
        }

        const balances = await readBalances(req.user._id, [account]);

        res.status(200).json({
            account: {
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || Number(account.openingBalance || 0),
            },
        });
    } catch (error) {
        next(error);
    }
};

export const listTransactions = async (req, res, next) => {
    try {
        const query = { user: req.user._id, ...KEPT };

        // One month of them when a month is asked for; all of them otherwise
        if (req.query.month) {
            query.monthKey = req.query.month;
        }

        // A page at a time: `limit` of them, after the `offset` newest. `total` is how many there are in all.
        const limit = Number(req.query.limit) || PAGE_SIZE;
        const offset = Number(req.query.offset) || 0;

        const [transactions, total] = await Promise.all([
            populated(ExpenseTransaction.find(query)).sort(NEWEST_FIRST).skip(offset).limit(limit),
            ExpenseTransaction.countDocuments(query),
        ]);

        res.status(200).json({ transactions, total });
    } catch (error) {
        next(error);
    }
};

export const updateTransaction = async (req, res, next) => {
    try {
        const existing = await ExpenseTransaction.findOne({ _id: req.params.id, user: req.user._id, ...KEPT });
        if (!existing) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        const { accountId, transferToAccountId, subscriptionId } = req.body;

        if (accountId && !(await ownsAccount(req.user._id, accountId))) {
            return res.status(404).json({ message: "Selected account not found" });
        }

        if (transferToAccountId && !(await ownsAccount(req.user._id, transferToAccountId))) {
            return res.status(404).json({ message: "Destination account not found" });
        }

        if (subscriptionId && !(await ownsSubscription(req.user._id, subscriptionId))) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        const payload = {
            type: req.body.type ?? existing.type,
            amount: req.body.amount !== undefined ? Number(req.body.amount) : existing.amount,
            category: req.body.category ?? existing.category,
            description: req.body.description ?? existing.description,
            paymentMethod: req.body.paymentMethod ?? existing.paymentMethod,
            account: accountId ?? existing.account,
            transferToAccount: transferToAccountId !== undefined ? transferToAccountId || null : existing.transferToAccount,
            placeName: req.body.placeName ?? existing.placeName,
            transactionDate: req.body.transactionDate ?? existing.transactionDate,
            notes: req.body.notes ?? existing.notes,
            subscription: subscriptionId !== undefined ? subscriptionId || null : existing.subscription,
        };

        // Saved through the document so the pre('save') hook keeps monthKey in step with the date
        existing.set(payload);
        await existing.save();

        const updated = await populated(ExpenseTransaction.findById(existing._id));

        res.status(200).json({ transaction: updated });
    } catch (error) {
        next(error);
    }
};

export const deleteTransaction = async (req, res, next) => {
    try {
        // Into Trash: it stops counting towards balances and totals at once, and can be recovered as it was
        const transaction = await ExpenseTransaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, ...KEPT },
            { $set: trashStamp(req.user) },
            { returnDocument: "after" },
        );

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        res.status(200).json({
            message: "Transaction moved to Trash",
            id: req.params.id,
            purgeAt: transaction.purgeAt,
        });
    } catch (error) {
        next(error);
    }
};

export const createTransaction = async (req, res, next) => {
    try {
        const {
            type = "expense",
            amount,
            category = "Other",
            description = "",
            paymentMethod = "other",
            accountId,
            transferToAccountId = null,
            placeName = "Other",
            transactionDate,
            notes = "",
            subscriptionId = null,
        } = req.body;

        const accounts = await ensureDefaultAccounts(req.user._id);
        const primaryAccount = accounts.find((account) => account._id.toString() === accountId);

        if (!primaryAccount) {
            return res.status(404).json({ message: "Selected account not found" });
        }

        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }

        if (type === "transfer" && !transferToAccountId) {
            return res.status(400).json({ message: "Transfer requires a destination account" });
        }

        if (transferToAccountId && !accounts.some((account) => account._id.toString() === transferToAccountId)) {
            return res.status(404).json({ message: "Destination account not found" });
        }

        if (subscriptionId && !(await ownsSubscription(req.user._id, subscriptionId))) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        if (!PAYMENT_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ message: "Invalid payment method" });
        }

        const transaction = await ExpenseTransaction.create({
            user: req.user._id,
            type,
            amount: Number(amount),
            category: CATEGORIES.includes(category) ? category : "Other",
            description,
            paymentMethod,
            account: accountId,
            transferToAccount: transferToAccountId || null,
            placeName: placeName?.trim() || "Other",
            // No date given: it happened today, in the user's timezone
            transactionDate: transactionDate || new Date(`${getUserToday(req.user)}T00:00:00Z`),
            notes,
            subscription: subscriptionId || null,
        });

        if (type === "expense" && transaction.placeName && normalizePlaceName(transaction.placeName) !== "other") {
            const normalizedName = normalizePlaceName(transaction.placeName);
            await KnownSpendPlace.findOneAndUpdate(
                { user: req.user._id, normalizedName },
                {
                    user: req.user._id,
                    name: transaction.placeName,
                    normalizedName,
                    category: transaction.category || "Other",
                    $inc: { transactionCount: 1, totalSpent: Number(amount) },
                    lastVisitedAt: transaction.transactionDate,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );
        }

        const saved = await populated(ExpenseTransaction.findById(transaction._id));

        const refreshedAccounts = await ExpenseAccount.find({ user: req.user._id }).sort({ sortOrder: 1, createdAt: 1 });
        const balances = await readBalances(req.user._id, refreshedAccounts);

        res.status(201).json({
            transaction: saved,
            accountBalances: withBalances(refreshedAccounts, balances),
        });
    } catch (error) {
        next(error);
    }
};

export const listSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await ExpenseSubscription.find({ user: req.user._id, ...KEPT })
            .populate("account", "name type")
            .sort({ isActive: -1, nextDueDate: 1 });

        res.status(200).json({ subscriptions });
    } catch (error) {
        next(error);
    }
};

export const createSubscription = async (req, res, next) => {
    try {
        const { name, amount, category = "Other", frequency = "monthly", accountId, description = "", nextDueDate, reminderDays = 3 } = req.body;

        if (!name || !accountId) {
            return res.status(400).json({ message: "Name and account are required" });
        }

        const account = await ExpenseAccount.findOne({ _id: accountId, user: req.user._id });
        if (!account) {
            return res.status(404).json({ message: "Subscription account not found" });
        }

        const subscription = await ExpenseSubscription.create({
            user: req.user._id,
            name,
            amount: Number(amount),
            category: CATEGORIES.includes(category) ? category : "Other",
            frequency,
            account: accountId,
            description,
            nextDueDate: nextDueDate || Date.now(),
            reminderDays,
        });

        const populated = await ExpenseSubscription.findById(subscription._id).populate("account", "name type");
        res.status(201).json({ subscription: populated });
    } catch (error) {
        next(error);
    }
};

export const updateSubscription = async (req, res, next) => {
    try {
        const { accountId, ...payload } = req.body;

        if (accountId) {
            if (!(await ownsAccount(req.user._id, accountId))) {
                return res.status(404).json({ message: "Subscription account not found" });
            }
            payload.account = accountId;
        }

        const subscription = await ExpenseSubscription.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, ...KEPT },
            payload,
            { new: true, runValidators: true },
        ).populate("account", "name type");

        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        res.status(200).json({ subscription });
    } catch (error) {
        next(error);
    }
};

export const deleteSubscription = async (req, res, next) => {
    try {
        const subscription = await ExpenseSubscription.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id, ...KEPT },
            { $set: trashStamp(req.user) },
            { returnDocument: "after" },
        );

        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        res.status(200).json({
            message: "Subscription moved to Trash",
            id: req.params.id,
            purgeAt: subscription.purgeAt,
        });
    } catch (error) {
        next(error);
    }
};

export const listKnownPlaces = async (req, res, next) => {
    try {
        const search = String(req.query.search || "").trim();
        const query = { user: req.user._id };

        if (search) {
            query.name = { $regex: escapeRegex(search), $options: "i" };
        }

        const places = await KnownSpendPlace.find(query)
            .sort({ transactionCount: -1, lastVisitedAt: -1 })
            .limit(30);

        res.status(200).json({ places });
    } catch (error) {
        next(error);
    }
};

export const listBudgets = async (req, res, next) => {
    try {
        const budgets = await ExpenseBudget.find({ user: req.user._id }).sort({ category: 1 });
        res.status(200).json({ budgets });
    } catch (error) {
        next(error);
    }
};

export const upsertBudget = async (req, res, next) => {
    try {
        const { category, monthlyLimit, alertThreshold = 0.8, isActive = true } = req.body;

        if (!category || monthlyLimit === undefined) {
            return res.status(400).json({ message: "Category and monthly limit are required" });
        }

        const budget = await ExpenseBudget.findOneAndUpdate(
            { user: req.user._id, category },
            {
                user: req.user._id,
                category,
                monthlyLimit: Number(monthlyLimit),
                alertThreshold: Number(alertThreshold),
                isActive: Boolean(isActive),
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );

        res.status(200).json({ budget });
    } catch (error) {
        next(error);
    }
};

const escapeCsv = (value) => {
    let text = String(value ?? "");

    // Spreadsheet apps run text cells that start with these characters as formulas.
    // A leading quote makes them plain text. Numbers are left alone.
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
    }

    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

export const exportMonthlyCsv = async (req, res, next) => {
    try {
        const month = String(req.query.month || getUserMonthKey(req.user));
        // The whole month on purpose: a file of it is no use in pieces
        const transactions = await populated(
            ExpenseTransaction.find({ user: req.user._id, monthKey: month, ...KEPT }),
        ).sort(NEWEST_FIRST);

        const rows = [
            ["date", "type", "category", "place", "description", "amount", "paymentMethod", "account", "destinationAccount", "notes"],
            ...transactions.map((transaction) => [
                new Date(transaction.transactionDate).toISOString().slice(0, 10),
                transaction.type,
                transaction.category,
                transaction.placeName,
                transaction.description,
                transaction.amount,
                transaction.paymentMethod,
                transaction.account?.name || "",
                transaction.transferToAccount?.name || "",
                transaction.notes,
            ]),
        ];

        const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=expenses-${month}.csv`);
        res.status(200).send(csv);
    } catch (error) {
        next(error);
    }
};