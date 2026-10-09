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

const getRefId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "object" && value._id) {
        return value._id.toString();
    }

    return value.toString();
};

const buildAccountBalanceMap = (accounts = [], transactions = []) => {
    const balances = new Map();

    accounts.forEach((account) => {
        balances.set(account._id.toString(), Number(account.openingBalance || 0));
    });

    transactions
        .slice()
        .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate))
        .forEach((transaction) => {
            const amount = Number(transaction.amount || 0);
            const accountId = getRefId(transaction.account);
            const transferToId = getRefId(transaction.transferToAccount);

            if (transaction.type === "expense") {
                balances.set(accountId, (balances.get(accountId) || 0) - amount);
            }

            if (transaction.type === "income") {
                balances.set(accountId, (balances.get(accountId) || 0) + amount);
            }

            if (transaction.type === "transfer") {
                balances.set(accountId, (balances.get(accountId) || 0) - amount);
                if (transferToId) {
                    balances.set(transferToId, (balances.get(transferToId) || 0) + amount);
                }
            }
        });

    return balances;
};

// A transaction's date is a calendar day kept at UTC midnight
const dayOf = (transaction) => new Date(transaction.transactionDate).toISOString().slice(0, 10);

const sumOf = (transactions) =>
    transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

// What was spent, by the place it was spent at, largest first
const totalsByPlace = (expenses) =>
    Object.values(
        expenses.reduce((acc, transaction) => {
            const key = transaction.placeName || "Other";
            if (!acc[key]) {
                acc[key] = {
                    name: key,
                    total: 0,
                    count: 0,
                };
            }
            acc[key].total += Number(transaction.amount || 0);
            acc[key].count += 1;
            return acc;
        }, {}),
    ).sort((a, b) => b.total - a.total);

/**
 * Everything the Expenses screen shows for one month.
 * @param {String} today - the user's own today, "YYYY-MM-DD"
 * @param {String} month - the month on show, "YYYY-MM". The month today is in unless another was asked for.
 */
const aggregateSummary = (accounts, transactions, subscriptions, places, today, month) => {
    const currentMonthKey = today.slice(0, 7);
    const previousMonthKey = shiftMonth(currentMonthKey, -1);
    const expenses = transactions.filter((transaction) => transaction.type === "expense");
    const expensesIn = (monthKey) => expenses.filter((transaction) => transaction.monthKey === monthKey);

    const currentMonthExpenses = expensesIn(currentMonthKey);
    const lastMonthExpenses = expensesIn(previousMonthKey);
    const monthExpenses = expensesIn(month);
    const monthBefore = expensesIn(shiftMonth(month, -1));

    const monthSeries = Array.from({ length: 6 }, (_, index) => {
        const monthKey = shiftMonth(month, index - 5);
        const monthTransactions = expensesIn(monthKey);
        const total = sumOf(monthTransactions);
        const byCategory = monthTransactions.reduce((acc, transaction) => {
            const key = transaction.category || "Other";
            acc[key] = (acc[key] || 0) + Number(transaction.amount || 0);
            return acc;
        }, {});

        const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0] || ["Other", 0];

        return {
            monthKey,
            label: getReadableMonth(monthKey),
            total,
            topCategory: topCategory[0],
            topCategoryTotal: topCategory[1],
        };
    });

    const categoryTotals = monthExpenses.reduce((acc, transaction) => {
        const key = transaction.category || "Other";
        acc[key] = (acc[key] || 0) + Number(transaction.amount || 0);
        return acc;
    }, {});

    const categoryBudgets = {};

    // Months are written "YYYY-MM", so they sort as text
    const monthKeys = transactions.map((transaction) => transaction.monthKey).filter(Boolean).sort();

    // The same stretch of the month before: on the 9th, what had been spent by the 9th of last month.
    // Only said of the month that is still running.
    const dayOfMonth = today.slice(8);
    const previousMonthToDate =
        month === currentMonthKey
            ? sumOf(lastMonthExpenses.filter((transaction) => dayOf(transaction).slice(8) <= dayOfMonth))
            : null;

    const recentTransactions = transactions.slice().sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)).slice(0, 16);
    const balances = buildAccountBalanceMap(accounts, transactions);

    return {
        accounts: accounts.map((account) => ({
            ...account.toObject(),
            currentBalance: balances.get(account._id.toString()) || 0,
        })),
        today,
        currentMonthKey,
        currentMonthExpensesTotal: sumOf(currentMonthExpenses),
        lastMonthExpensesTotal: sumOf(lastMonthExpenses),
        currentMonthExpenseCount: currentMonthExpenses.length,
        // The month on show, and how far the months with anything in them reach
        month,
        firstMonth: monthKeys[0] ?? null,
        lastMonth: monthKeys.at(-1) ?? null,
        monthExpensesTotal: sumOf(monthExpenses),
        monthExpenseCount: monthExpenses.length,
        monthIncomeTotal: sumOf(
            transactions.filter((transaction) => transaction.type === "income" && transaction.monthKey === month),
        ),
        previousMonthExpensesTotal: sumOf(monthBefore),
        previousMonthToDate,
        monthSeries,
        categoryTotals: Object.entries(categoryTotals)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total),
        placeTotals: totalsByPlace(expenses),
        monthPlaceTotals: totalsByPlace(monthExpenses),
        recentTransactions,
        subscriptions,
        suggestedPlaces: places.map((place) => place.name).sort((a, b) => a.localeCompare(b)),
        categoryBudgets,
    };
};

export const getSummary = async (req, res, next) => {
    try {
        const accounts = await ensureDefaultAccounts(req.user._id);
        const [transactions, subscriptions, places] = await Promise.all([
            ExpenseTransaction.find({ user: req.user._id, ...KEPT })
                .populate("account", "name type")
                .populate("transferToAccount", "name type")
                .sort({ transactionDate: -1 }),
            ExpenseSubscription.find({ user: req.user._id, ...KEPT }).sort({ isActive: -1, nextDueDate: 1 }),
            KnownSpendPlace.find({ user: req.user._id }).sort({ transactionCount: -1, lastVisitedAt: -1 }),
        ]);
        const budgets = await ExpenseBudget.find({ user: req.user._id, isActive: true });

        const today = getUserToday(req.user);
        const summary = aggregateSummary(
            accounts,
            transactions,
            subscriptions,
            places,
            today,
            req.query.month || today.slice(0, 7),
        );
        summary.budgets = budgets;
        res.status(200).json(summary);
    } catch (error) {
        next(error);
    }
};

export const getAccounts = async (req, res, next) => {
    try {
        const accounts = await ensureDefaultAccounts(req.user._id);
        const transactions = await ExpenseTransaction.find({ user: req.user._id, ...KEPT }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap(accounts, transactions);

        res.status(200).json({
            accounts: accounts.map((account) => ({
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || 0,
            })),
        });
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

        const transactions = await ExpenseTransaction.find({ user: req.user._id, ...KEPT }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap([account], transactions);

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

        const transactions = await ExpenseTransaction.find(query)
            .populate("account", "name type")
            .populate("transferToAccount", "name type")
            // The newest day first, and within a day the one logged last
            .sort({ transactionDate: -1, createdAt: -1 });

        res.status(200).json({ transactions });
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

        const updated = await ExpenseTransaction.findById(existing._id)
            .populate("account", "name type")
            .populate("transferToAccount", "name type");

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

        const populated = await ExpenseTransaction.findById(transaction._id)
            .populate("account", "name type")
            .populate("transferToAccount", "name type");

        const refreshedAccounts = await ExpenseAccount.find({ user: req.user._id }).sort({ sortOrder: 1, createdAt: 1 });
        const allTransactions = await ExpenseTransaction.find({ user: req.user._id, ...KEPT }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap(refreshedAccounts, allTransactions);

        res.status(201).json({
            transaction: populated,
            accountBalances: refreshedAccounts.map((account) => ({
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || 0,
            })),
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
        const transactions = await ExpenseTransaction.find({ user: req.user._id, monthKey: month, ...KEPT })
            .populate("account", "name type")
            .populate("transferToAccount", "name type")
            .sort({ transactionDate: -1 });

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