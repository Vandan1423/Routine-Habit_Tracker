import ExpenseAccount from "../models/ExpenseAccount.js";
import ExpenseBudget from "../models/ExpenseBudget.js";
import ExpenseSubscription from "../models/ExpenseSubscription.js";
import ExpenseTransaction from "../models/ExpenseTransaction.js";
import KnownSpendPlace from "../models/KnownSpendPlace.js";

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

const monthKeyFromDate = (date) => {
    const target = date instanceof Date ? date : new Date(date);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
};

const getMonthWindow = (offset = 0) => {
    const date = new Date();
    date.setMonth(date.getMonth() - offset, 1);
    date.setHours(0, 0, 0, 0);
    return monthKeyFromDate(date);
};

const getReadableMonth = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
};

const normalizePlaceName = (value = "") => value.trim().toLowerCase().replace(/\s+/g, " ");

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

const aggregateSummary = (accounts, transactions, subscriptions, places) => {
    const now = new Date();
    const currentMonthKey = monthKeyFromDate(now);
    const previousMonthKey = getMonthWindow(1);
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const currentMonthExpenses = transactions.filter(
        (transaction) => transaction.type === "expense" && transaction.monthKey === currentMonthKey,
    );
    const lastMonthExpenses = transactions.filter(
        (transaction) => transaction.type === "expense" && transaction.monthKey === previousMonthKey,
    );

    const monthSeries = Array.from({ length: 6 }, (_, index) => {
        const d = new Date(currentYear, currentMonthIndex - (5 - index), 1);
        const monthKey = monthKeyFromDate(d);
        const monthTransactions = transactions.filter(
            (transaction) => transaction.type === "expense" && transaction.monthKey === monthKey,
        );
        const total = monthTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
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

    const categoryTotals = currentMonthExpenses.reduce((acc, transaction) => {
        const key = transaction.category || "Other";
        acc[key] = (acc[key] || 0) + Number(transaction.amount || 0);
        return acc;
    }, {});

    const categoryBudgets = {};

    const placeTotals = transactions.filter((transaction) => transaction.type === "expense").reduce((acc, transaction) => {
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
    }, {});

    const recentTransactions = transactions.slice().sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)).slice(0, 16);
    const balances = buildAccountBalanceMap(accounts, transactions);

    return {
        accounts: accounts.map((account) => ({
            ...account.toObject(),
            currentBalance: balances.get(account._id.toString()) || 0,
        })),
        currentMonthKey,
        currentMonthExpensesTotal: currentMonthExpenses.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
        lastMonthExpensesTotal: lastMonthExpenses.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
        currentMonthExpenseCount: currentMonthExpenses.length,
        monthSeries,
        categoryTotals: Object.entries(categoryTotals)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total),
        placeTotals: Object.values(placeTotals).sort((a, b) => b.total - a.total),
        recentTransactions,
        subscriptions,
        suggestedPlaces: places.map((place) => place.name).sort((a, b) => a.localeCompare(b)),
        categoryBudgets,
    };
};

export const getSummary = async (req, res) => {
    try {
        const accounts = await ensureDefaultAccounts(req.user._id);
        const [transactions, subscriptions, places] = await Promise.all([
            ExpenseTransaction.find({ user: req.user._id })
                .populate("account", "name type")
                .populate("transferToAccount", "name type")
                .sort({ transactionDate: -1 }),
            ExpenseSubscription.find({ user: req.user._id }).sort({ isActive: -1, nextDueDate: 1 }),
            KnownSpendPlace.find({ user: req.user._id }).sort({ transactionCount: -1, lastVisitedAt: -1 }),
        ]);
        const budgets = await ExpenseBudget.find({ user: req.user._id, isActive: true });

        const summary = aggregateSummary(accounts, transactions, subscriptions, places);
        summary.budgets = budgets;
        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ message: "Error loading expense summary", error: error.message });
    }
};

export const getAccounts = async (req, res) => {
    try {
        const accounts = await ensureDefaultAccounts(req.user._id);
        const transactions = await ExpenseTransaction.find({ user: req.user._id }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap(accounts, transactions);

        res.status(200).json({
            accounts: accounts.map((account) => ({
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || 0,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: "Error loading accounts", error: error.message });
    }
};

export const updateAccount = async (req, res) => {
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

        const transactions = await ExpenseTransaction.find({ user: req.user._id }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap([account], transactions);

        res.status(200).json({
            account: {
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || Number(account.openingBalance || 0),
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating account", error: error.message });
    }
};

export const listTransactions = async (req, res) => {
    try {
        const transactions = await ExpenseTransaction.find({ user: req.user._id })
            .populate("account", "name type")
            .populate("transferToAccount", "name type")
            .sort({ transactionDate: -1 });

        res.status(200).json({ transactions });
    } catch (error) {
        res.status(500).json({ message: "Error loading transactions", error: error.message });
    }
};

export const updateTransaction = async (req, res) => {
    try {
        const existing = await ExpenseTransaction.findOne({ _id: req.params.id, user: req.user._id });
        if (!existing) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        const payload = {
            type: req.body.type ?? existing.type,
            amount: req.body.amount !== undefined ? Number(req.body.amount) : existing.amount,
            category: req.body.category ?? existing.category,
            description: req.body.description ?? existing.description,
            paymentMethod: req.body.paymentMethod ?? existing.paymentMethod,
            account: req.body.accountId ?? existing.account,
            transferToAccount: req.body.transferToAccountId !== undefined ? req.body.transferToAccountId || null : existing.transferToAccount,
            placeName: req.body.placeName ?? existing.placeName,
            transactionDate: req.body.transactionDate ?? existing.transactionDate,
            notes: req.body.notes ?? existing.notes,
            subscription: req.body.subscriptionId !== undefined ? req.body.subscriptionId || null : existing.subscription,
        };

        const updated = await ExpenseTransaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            payload,
            { new: true, runValidators: true },
        )
            .populate("account", "name type")
            .populate("transferToAccount", "name type");

        res.status(200).json({ transaction: updated });
    } catch (error) {
        res.status(500).json({ message: "Error updating transaction", error: error.message });
    }
};

export const deleteTransaction = async (req, res) => {
    try {
        const transaction = await ExpenseTransaction.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        res.status(200).json({ message: "Transaction deleted", id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: "Error deleting transaction", error: error.message });
    }
};

export const createTransaction = async (req, res) => {
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
            transactionDate: transactionDate || Date.now(),
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
        const allTransactions = await ExpenseTransaction.find({ user: req.user._id }).sort({ transactionDate: 1 });
        const balances = buildAccountBalanceMap(refreshedAccounts, allTransactions);

        res.status(201).json({
            transaction: populated,
            accountBalances: refreshedAccounts.map((account) => ({
                ...account.toObject(),
                currentBalance: balances.get(account._id.toString()) || 0,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: "Error creating transaction", error: error.message });
    }
};

export const listSubscriptions = async (req, res) => {
    try {
        const subscriptions = await ExpenseSubscription.find({ user: req.user._id })
            .populate("account", "name type")
            .sort({ isActive: -1, nextDueDate: 1 });

        res.status(200).json({ subscriptions });
    } catch (error) {
        res.status(500).json({ message: "Error loading subscriptions", error: error.message });
    }
};

export const createSubscription = async (req, res) => {
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
        res.status(500).json({ message: "Error creating subscription", error: error.message });
    }
};

export const updateSubscription = async (req, res) => {
    try {
        const payload = {
            ...req.body,
        };

        if (payload.accountId) {
            payload.account = payload.accountId;
            delete payload.accountId;
        }

        const subscription = await ExpenseSubscription.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            payload,
            { new: true, runValidators: true },
        ).populate("account", "name type");

        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        res.status(200).json({ subscription });
    } catch (error) {
        res.status(500).json({ message: "Error updating subscription", error: error.message });
    }
};

export const deleteSubscription = async (req, res) => {
    try {
        const subscription = await ExpenseSubscription.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        res.status(200).json({ message: "Subscription deleted", id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: "Error deleting subscription", error: error.message });
    }
};

export const listKnownPlaces = async (req, res) => {
    try {
        const search = String(req.query.search || "").trim();
        const query = { user: req.user._id };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const places = await KnownSpendPlace.find(query)
            .sort({ transactionCount: -1, lastVisitedAt: -1 })
            .limit(30);

        res.status(200).json({ places });
    } catch (error) {
        res.status(500).json({ message: "Error loading known places", error: error.message });
    }
};

export const listBudgets = async (req, res) => {
    try {
        const budgets = await ExpenseBudget.find({ user: req.user._id }).sort({ category: 1 });
        res.status(200).json({ budgets });
    } catch (error) {
        res.status(500).json({ message: "Error loading budgets", error: error.message });
    }
};

export const upsertBudget = async (req, res) => {
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
        res.status(500).json({ message: "Error saving budget", error: error.message });
    }
};

const escapeCsv = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

export const exportMonthlyCsv = async (req, res) => {
    try {
        const month = String(req.query.month || monthKeyFromDate(new Date()));
        const transactions = await ExpenseTransaction.find({ user: req.user._id, monthKey: month })
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
        res.status(500).json({ message: "Error exporting monthly data", error: error.message });
    }
};