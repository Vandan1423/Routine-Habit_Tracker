import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import expenseService from "../../services/expenseService";
import styles from "./ExpensesPage.module.css";

const categories = [
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

const paymentMethods = [
    { label: "UPI", value: "upi" },
    { label: "Cash", value: "cash" },
    { label: "Card", value: "card" },
    { label: "Bank Transfer", value: "bank_transfer" },
    { label: "Other", value: "other" },
];

const transactionTypes = [
    { label: "Expense", value: "expense" },
    { label: "Income", value: "income" },
    { label: "Transfer", value: "transfer" },
];

const formatMoney = (value = 0) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const formatDate = (value) =>
    new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });

// Today as the user sees it on their device ("YYYY-MM-DD"). toISOString() would give the UTC date instead.
const getLocalToday = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
};

const initialLog = {
    type: "expense",
    amount: "",
    category: "Food & Dining",
    description: "",
    paymentMethod: "upi",
    accountId: "",
    transferToAccountId: "",
    placeName: "",
    transactionDate: getLocalToday(),
    notes: "",
};

const initialSubscription = {
    name: "",
    amount: "",
    category: "Bills & Utilities",
    frequency: "monthly",
    accountId: "",
    description: "",
    nextDueDate: getLocalToday(),
    reminderDays: 3,
};

const COLORS = ["#1a7a4a", "#2d9e63", "#5f8e72", "#c59d4f", "#e58c51", "#8b5cf6"];

function StatCard({ label, value, hint, accent = false }) {
    return (
        <div className={`${styles.statCard} ${accent ? styles.statCardAccent : ""}`}>
            <span className={styles.statLabel}>{label}</span>
            <strong className={styles.statValue}>{value}</strong>
            <span className={styles.statHint}>{hint}</span>
        </div>
    );
}

function SectionHeader({ title, subtitle, action }) {
    return (
        <div className={styles.sectionHeader}>
            <div>
                <h2>{title}</h2>
                <p>{subtitle}</p>
            </div>
            {action}
        </div>
    );
}

function InlineField({ label, children, wide = false }) {
    return (
        <label className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
            <span>{label}</span>
            {children}
        </label>
    );
}

export default function ExpensesPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        accounts: [],
        monthSeries: [],
        categoryTotals: [],
        placeTotals: [],
        recentTransactions: [],
        subscriptions: [],
        suggestedPlaces: [],
        currentMonthExpensesTotal: 0,
        lastMonthExpensesTotal: 0,
    });
    const [logForm, setLogForm] = useState(initialLog);
    const [subscriptionForm, setSubscriptionForm] = useState(initialSubscription);
    const [savingLog, setSavingLog] = useState(false);
    const [savingSubscription, setSavingSubscription] = useState(false);
    const [savingAccountId, setSavingAccountId] = useState("");
    const [savingBudget, setSavingBudget] = useState(false);
    const [places, setPlaces] = useState([]);
    const [accountDrafts, setAccountDrafts] = useState({});
    const [budgetForm, setBudgetForm] = useState({
        category: "Food & Dining",
        monthlyLimit: "",
        alertThreshold: 0.8,
        isActive: true,
    });
    const [editingTransactionId, setEditingTransactionId] = useState("");
    const [editingSubscriptionId, setEditingSubscriptionId] = useState("");

    const loadSummary = async () => {
        setLoading(true);
        try {
            const data = await expenseService.getSummary();
            setSummary(data);
            setAccountDrafts(
                (data.accounts || []).reduce((drafts, account) => {
                    drafts[account._id] = String(account.openingBalance ?? 0);
                    return drafts;
                }, {}),
            );
            setLogForm((current) => ({
                ...current,
                accountId: current.accountId || data.accounts?.[0]?._id || "",
                transferToAccountId: current.transferToAccountId || data.accounts?.[1]?._id || "",
            }));
            setSubscriptionForm((current) => ({
                ...current,
                accountId: current.accountId || data.accounts?.[0]?._id || "",
            }));
            if (!budgetForm.monthlyLimit) {
                setBudgetForm((current) => ({
                    ...current,
                    category: data.budgets?.[0]?.category || current.category,
                }));
            }
            setPlaces((data.suggestedPlaces || []).map((name) => ({ name })));
        } catch (error) {
            console.error("Expense summary error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Pushing the fetch to the next event loop tick prevents the synchronous double-render
        const fetchTimer = setTimeout(() => {
            loadSummary();
        }, 0);

        return () => clearTimeout(fetchTimer);
    }, []);

    const accountTotal = useMemo(
        () => summary.accounts.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0),
        [summary.accounts],
    );

    const budgetRows = useMemo(() => {
        const budgetMap = new Map((summary.budgets || []).map((budget) => [budget.category, budget]));
        return categories.map((category) => {
            const spent = Number(summary.categoryTotals.find((item) => item.category === category)?.total || 0);
            const budget = budgetMap.get(category);
            const limit = Number(budget?.monthlyLimit || 0);
            const percent = limit > 0 ? spent / limit : 0;
            return {
                category,
                spent,
                limit,
                percent,
                status: !budget
                    ? "unset"
                    : percent >= 1
                        ? "over"
                        : percent >= Number(budget.alertThreshold || 0.8)
                            ? "warning"
                            : "ok",
                budget,
            };
        });
    }, [summary.budgets, summary.categoryTotals]);

    const overspentBudgets = budgetRows.filter((row) => row.status === "over");
    const warningBudgets = budgetRows.filter((row) => row.status === "warning");

    const topCategoryName = summary.categoryTotals?.[0]?.category || "None";
    const topCategoryTotal = summary.categoryTotals?.[0]?.total || 0;

    const handleLogChange = (key, value) => {
        setLogForm((current) => ({ ...current, [key]: value }));
    };

    const handleSubscriptionChange = (key, value) => {
        setSubscriptionForm((current) => ({ ...current, [key]: value }));
    };

    const handleBudgetChange = (key, value) => {
        setBudgetForm((current) => ({ ...current, [key]: value }));
    };

    const handleAccountDraftChange = (accountId, value) => {
        setAccountDrafts((current) => ({ ...current, [accountId]: value }));
    };

    const handleAccountBalanceChange = async (accountId, openingBalance) => {
        setSavingAccountId(accountId);
        try {
            await expenseService.updateAccount(accountId, { openingBalance: Number(openingBalance || 0) });
            await loadSummary();
        } catch (error) {
            console.error("Update account error:", error);
        } finally {
            setSavingAccountId("");
        }
    };

    const handleSubmitLog = async (event) => {
        event.preventDefault();
        setSavingLog(true);
        try {
            const payload = {
                ...logForm,
                amount: Number(logForm.amount),
                transferToAccountId: logForm.type === "transfer" ? logForm.transferToAccountId : null,
            };
            if (editingTransactionId) {
                await expenseService.updateTransaction(editingTransactionId, payload);
            } else {
                await expenseService.createTransaction(payload);
            }
            setLogForm((current) => ({
                ...initialLog,
                accountId: current.accountId,
                transferToAccountId: current.transferToAccountId,
            }));
            setEditingTransactionId("");
            await loadSummary();
        } catch (error) {
            console.error("Create transaction error:", error);
        } finally {
            setSavingLog(false);
        }
    };

    const handleSubmitSubscription = async (event) => {
        event.preventDefault();
        setSavingSubscription(true);
        try {
            const payload = {
                ...subscriptionForm,
                amount: Number(subscriptionForm.amount),
                reminderDays: Number(subscriptionForm.reminderDays),
            };
            if (editingSubscriptionId) {
                await expenseService.updateSubscription(editingSubscriptionId, payload);
            } else {
                await expenseService.createSubscription(payload);
            }
            setSubscriptionForm((current) => ({
                ...initialSubscription,
                accountId: current.accountId,
            }));
            setEditingSubscriptionId("");
            await loadSummary();
        } catch (error) {
            console.error("Create subscription error:", error);
        } finally {
            setSavingSubscription(false);
        }
    };

    const handleSubmitBudget = async (event) => {
        event.preventDefault();
        setSavingBudget(true);
        try {
            await expenseService.upsertBudget({
                ...budgetForm,
                monthlyLimit: Number(budgetForm.monthlyLimit),
                alertThreshold: Number(budgetForm.alertThreshold),
            });
            setBudgetForm((current) => ({
                ...current,
                monthlyLimit: "",
            }));
            await loadSummary();
        } catch (error) {
            console.error("Budget save error:", error);
        } finally {
            setSavingBudget(false);
        }
    };

    const handleDeleteTransaction = async (transactionId) => {
        if (!window.confirm("Delete this transaction?")) {
            return;
        }

        try {
            await expenseService.deleteTransaction(transactionId);
            await loadSummary();
        } catch (error) {
            console.error("Delete transaction error:", error);
        }
    };

    const handleToggleSubscription = async (subscription) => {
        try {
            await expenseService.updateSubscription(subscription._id, {
                isActive: !subscription.isActive,
            });
            await loadSummary();
        } catch (error) {
            console.error("Toggle subscription error:", error);
        }
    };

    const handleEditTransaction = (transaction) => {
        setEditingTransactionId(transaction._id);
        setLogForm({
            type: transaction.type,
            amount: String(transaction.amount ?? ""),
            category: transaction.category || "Other",
            description: transaction.description || "",
            paymentMethod: transaction.paymentMethod || "other",
            accountId: transaction.account?._id || transaction.account || "",
            transferToAccountId: transaction.transferToAccount?._id || transaction.transferToAccount || "",
            placeName: transaction.placeName || "",
            transactionDate: new Date(transaction.transactionDate).toISOString().slice(0, 10),
            notes: transaction.notes || "",
        });
    };

    const handleEditSubscription = (subscription) => {
        setEditingSubscriptionId(subscription._id);
        setSubscriptionForm({
            name: subscription.name || "",
            amount: String(subscription.amount ?? ""),
            category: subscription.category || "Other",
            frequency: subscription.frequency || "monthly",
            accountId: subscription.account?._id || subscription.account || "",
            description: subscription.description || "",
            nextDueDate: new Date(subscription.nextDueDate).toISOString().slice(0, 10),
            reminderDays: subscription.reminderDays ?? 3,
        });
    };

    const handleCancelEditTransaction = () => {
        setEditingTransactionId("");
        setLogForm(initialLog);
    };

    const handleCancelEditSubscription = () => {
        setEditingSubscriptionId("");
        setSubscriptionForm(initialSubscription);
    };

    const handleDeleteSubscription = async (subscriptionId) => {
        if (!window.confirm("Delete this subscription?")) {
            return;
        }

        try {
            await expenseService.deleteSubscription(subscriptionId);
            await loadSummary();
        } catch (error) {
            console.error("Delete subscription error:", error);
        }
    };

    const handleExportMonthly = async () => {
        try {
            const response = await expenseService.exportMonthlyCsv(summary.currentMonthKey);
            const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `expenses-${summary.currentMonthKey}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loadingPulse} />
                <div className={styles.loadingPulse} />
                <div className={styles.loadingPulse} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroGlow} />
                <div className={styles.heroHeader}>
                    <div>
                        <p className={styles.kicker}>Premium money dashboard</p>
                        <h1>Track every rupee without losing the calm.</h1>
                        <p className={styles.heroCopy}>
                            Live balance, expenses, subscriptions, known places, and spending patterns in one place.
                        </p>
                    </div>
                    <div className={styles.heroStatRail}>
                        <StatCard
                            label="Current balance"
                            value={formatMoney(accountTotal)}
                            hint={`${summary.accounts.length} accounts connected`}
                            accent
                        />
                        <StatCard
                            label="This month"
                            value={formatMoney(summary.currentMonthExpensesTotal)}
                            hint="Total spending so far"
                        />
                        <StatCard
                            label="Last month"
                            value={formatMoney(summary.lastMonthExpensesTotal)}
                            hint="Previous month spending"
                        />
                        <StatCard
                            label="Budget alerts"
                            value={`${overspentBudgets.length + warningBudgets.length}`}
                            hint="Categories nearing limit"
                        />
                    </div>
                </div>

                <div className={styles.heroBody}>
                    <div className={styles.heroChartCard}>
                        <div className={styles.chartCopy}>
                            <span>Six month trend</span>
                            <strong>Monthly spend rhythm</strong>
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={summary.monthSeries || []}>
                                <defs>
                                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="8%" stopColor="#2d9e63" stopOpacity={0.35} />
                                        <stop offset="90%" stopColor="#2d9e63" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(20, 92, 55, 0.12)" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                                <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(value) => formatMoney(value)} />
                                <Area type="monotone" dataKey="total" stroke="#1a7a4a" fill="url(#expenseFill)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={styles.heroInsightColumn}>
                        <div className={styles.insightCard}>
                            <span>Top category</span>
                            <strong>{topCategoryName}</strong>
                            <p>{formatMoney(topCategoryTotal)}</p>
                        </div>
                        <div className={styles.insightCard}>
                            <span>Known places</span>
                            <strong>{summary.placeTotals?.length || 0}</strong>
                            <p>Auto-suggested from your logs</p>
                        </div>
                        <div className={styles.insightCard}>
                            <span>Subscriptions</span>
                            <strong>{summary.subscriptions?.length || 0}</strong>
                            <p>Recurring costs tracked separately</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.accountsGrid}>
                {summary.accounts.map((account) => (
                    <div className={styles.accountCard} key={account._id}>
                        <div className={styles.accountMeta}>
                            <div>
                                <span>{account.type === "bank" ? "Bank account" : "Cash wallet"}</span>
                                <strong>{account.name}</strong>
                            </div>
                            <div className={styles.balanceBadge}>{formatMoney(account.currentBalance)}</div>
                        </div>
                        <label className={styles.balanceEdit}>
                            <span>Set current balance</span>
                            <div className={styles.balanceEditRow}>
                                <input
                                    id={`balance-${account._id}`}
                                    type="number"
                                    value={accountDrafts[account._id] ?? String(account.openingBalance ?? 0)}
                                    onChange={(event) => handleAccountDraftChange(account._id, event.target.value)}
                                    onBlur={(event) => handleAccountBalanceChange(account._id, event.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAccountBalanceChange(account._id, accountDrafts[account._id] ?? account.openingBalance)}
                                    disabled={savingAccountId === account._id}
                                >
                                    {savingAccountId === account._id ? "Saving..." : "Update"}
                                </button>
                            </div>
                        </label>
                    </div>
                ))}
            </section>

            <section className={styles.sectionBlock}>
                <SectionHeader
                    title="Log expense"
                    subtitle="Add a transaction, tag the place, and watch the balance update instantly."
                    action={editingTransactionId ? <button type="button" className={styles.ghostButton} onClick={handleCancelEditTransaction}>Cancel edit</button> : null}
                />
                <form className={styles.logForm} onSubmit={handleSubmitLog}>
                    <InlineField label="Type">
                        <select value={logForm.type} onChange={(event) => handleLogChange("type", event.target.value)}>
                            {transactionTypes.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                        </select>
                    </InlineField>
                    <InlineField label="Amount">
                        <input type="number" min="0" step="1" value={logForm.amount} onChange={(event) => handleLogChange("amount", event.target.value)} placeholder="0" />
                    </InlineField>
                    <InlineField label="Account">
                        <select value={logForm.accountId} onChange={(event) => handleLogChange("accountId", event.target.value)}>
                            {summary.accounts.map((account) => (
                                <option key={account._id} value={account._id}>{account.name}</option>
                            ))}
                        </select>
                    </InlineField>
                    {logForm.type === "transfer" && (
                        <InlineField label="Transfer to">
                            <select value={logForm.transferToAccountId} onChange={(event) => handleLogChange("transferToAccountId", event.target.value)}>
                                {summary.accounts.map((account) => (
                                    <option key={account._id} value={account._id}>{account.name}</option>
                                ))}
                            </select>
                        </InlineField>
                    )}
                    <InlineField label="Category">
                        <select value={logForm.category} onChange={(event) => handleLogChange("category", event.target.value)}>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                    </InlineField>
                    <InlineField label="Payment method">
                        <select value={logForm.paymentMethod} onChange={(event) => handleLogChange("paymentMethod", event.target.value)}>
                            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                        </select>
                    </InlineField>
                    <InlineField label="Known place" wide>
                        <input list="known-places" value={logForm.placeName} onChange={(event) => handleLogChange("placeName", event.target.value)} placeholder="Hotel, office canteen, other" />
                        <datalist id="known-places">
                            {(places.length ? places : summary.suggestedPlaces.map((name) => ({ name }))).map((place) => (
                                <option key={place.name} value={place.name} />
                            ))}
                        </datalist>
                    </InlineField>
                    <InlineField label="Description" wide>
                        <input type="text" value={logForm.description} onChange={(event) => handleLogChange("description", event.target.value)} placeholder="Short note about this expense" />
                    </InlineField>
                    <InlineField label="Date">
                        <input type="date" value={logForm.transactionDate} onChange={(event) => handleLogChange("transactionDate", event.target.value)} />
                    </InlineField>
                    <InlineField label="Notes" wide>
                        <input type="text" value={logForm.notes} onChange={(event) => handleLogChange("notes", event.target.value)} placeholder="Optional note" />
                    </InlineField>
                    <div className={styles.formActions}>
                        <button type="button" className={styles.ghostButton} onClick={handleCancelEditTransaction} disabled={!editingTransactionId}>
                            Reset
                        </button>
                        <button type="submit" disabled={savingLog}>{savingLog ? "Saving..." : editingTransactionId ? "Update transaction" : "Save transaction"}</button>
                    </div>
                </form>
            </section>

            <section className={styles.sectionBlock}>
                <SectionHeader
                    title="Budgets"
                    subtitle="Set a monthly limit per category and see overspend warnings before they get out of hand."
                />
                <form className={styles.budgetForm} onSubmit={handleSubmitBudget}>
                    <InlineField label="Category">
                        <select value={budgetForm.category} onChange={(event) => handleBudgetChange("category", event.target.value)}>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                    </InlineField>
                    <InlineField label="Monthly limit">
                        <input type="number" min="0" step="1" value={budgetForm.monthlyLimit} onChange={(event) => handleBudgetChange("monthlyLimit", event.target.value)} placeholder="0" />
                    </InlineField>
                    <InlineField label="Alert threshold">
                        <input type="number" min="0.1" max="1" step="0.05" value={budgetForm.alertThreshold} onChange={(event) => handleBudgetChange("alertThreshold", event.target.value)} />
                    </InlineField>
                    <InlineField label="Active">
                        <select value={budgetForm.isActive ? "yes" : "no"} onChange={(event) => handleBudgetChange("isActive", event.target.value === "yes")}>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                        </select>
                    </InlineField>
                    <div className={styles.formActions}>
                        <button type="submit" disabled={savingBudget}>{savingBudget ? "Saving..." : "Save budget"}</button>
                    </div>
                </form>

                <div className={styles.budgetList}>
                    {budgetRows.map((row) => (
                        <div className={`${styles.budgetCard} ${row.status === "over" ? styles.budgetOver : row.status === "warning" ? styles.budgetWarning : ""}`} key={row.category}>
                            <div>
                                <strong>{row.category}</strong>
                                <p>{formatMoney(row.spent)} spent{row.limit > 0 ? ` of ${formatMoney(row.limit)}` : ""}</p>
                            </div>
                            <div className={styles.budgetMeta}>
                                <span>{row.limit > 0 ? `${Math.min(Math.round(row.percent * 100), 999)}%` : "Unset"}</span>
                                <small>{row.status === "over" ? "Over budget" : row.status === "warning" ? "Near limit" : "Healthy"}</small>
                                <div className={styles.cardActions}>
                                    <button type="button" onClick={() => {
                                        setBudgetForm({
                                            category: row.category,
                                            monthlyLimit: String(row.limit || ""),
                                            alertThreshold: row.budget?.alertThreshold ?? 0.8,
                                            isActive: row.budget?.isActive ?? true,
                                        });
                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}>Edit</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className={styles.twoColumnGrid}>
                <section className={styles.sectionBlock}>
                    <SectionHeader
                        title="Subscriptions"
                        subtitle="Keep recurring costs visible, due dates clear, and monthly leakage under control."
                        action={editingSubscriptionId ? <button type="button" className={styles.ghostButton} onClick={handleCancelEditSubscription}>Cancel edit</button> : null}
                    />
                    <form className={styles.subscriptionForm} onSubmit={handleSubmitSubscription}>
                        <InlineField label="Name">
                            <input type="text" value={subscriptionForm.name} onChange={(event) => handleSubscriptionChange("name", event.target.value)} placeholder="Netflix, hotel rent, etc." />
                        </InlineField>
                        <InlineField label="Amount">
                            <input type="number" min="0" step="1" value={subscriptionForm.amount} onChange={(event) => handleSubscriptionChange("amount", event.target.value)} />
                        </InlineField>
                        <InlineField label="Account">
                            <select value={subscriptionForm.accountId} onChange={(event) => handleSubscriptionChange("accountId", event.target.value)}>
                                {summary.accounts.map((account) => (
                                    <option key={account._id} value={account._id}>{account.name}</option>
                                ))}
                            </select>
                        </InlineField>
                        <InlineField label="Category">
                            <select value={subscriptionForm.category} onChange={(event) => handleSubscriptionChange("category", event.target.value)}>
                                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </InlineField>
                        <InlineField label="Frequency">
                            <select value={subscriptionForm.frequency} onChange={(event) => handleSubscriptionChange("frequency", event.target.value)}>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </InlineField>
                        <InlineField label="Next due">
                            <input type="date" value={subscriptionForm.nextDueDate} onChange={(event) => handleSubscriptionChange("nextDueDate", event.target.value)} />
                        </InlineField>
                        <InlineField label="Reminder days">
                            <input type="number" min="0" step="1" value={subscriptionForm.reminderDays} onChange={(event) => handleSubscriptionChange("reminderDays", event.target.value)} />
                        </InlineField>
                        <InlineField label="Description" wide>
                            <input type="text" value={subscriptionForm.description} onChange={(event) => handleSubscriptionChange("description", event.target.value)} placeholder="What this subscription covers" />
                        </InlineField>
                        <div className={styles.formActions}>
                            <button type="button" className={styles.ghostButton} onClick={handleCancelEditSubscription} disabled={!editingSubscriptionId}>
                                Reset
                            </button>
                            <button type="submit" disabled={savingSubscription}>{savingSubscription ? "Saving..." : editingSubscriptionId ? "Update subscription" : "Add subscription"}</button>
                        </div>
                    </form>

                    <div className={styles.subscriptionList}>
                        {summary.subscriptions.map((subscription) => (
                            <div className={styles.subscriptionCard} key={subscription._id}>
                                <div>
                                    <strong>{subscription.name}</strong>
                                    <p>{subscription.category} · {subscription.frequency}</p>
                                </div>
                                <div className={styles.subscriptionMeta}>
                                    <span>{formatMoney(subscription.amount)}</span>
                                    <small>Due {formatDate(subscription.nextDueDate)}</small>
                                    <div className={styles.cardActions}>
                                        <button type="button" onClick={() => handleEditSubscription(subscription)}>Edit</button>
                                        <button type="button" onClick={() => handleToggleSubscription(subscription)}>
                                            {subscription.isActive ? "Pause" : "Resume"}
                                        </button>
                                        <button type="button" className={styles.dangerButton} onClick={() => handleDeleteSubscription(subscription._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.sectionBlock}>
                    <SectionHeader
                        title="Money map"
                        subtitle="Where the money went this month, split by category and place."
                        action={<button type="button" className={styles.ghostButton} onClick={handleExportMonthly}>Export CSV</button>}
                    />
                    <div className={styles.chartStack}>
                        <div className={styles.chartCard}>
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={summary.categoryTotals.slice(0, 8)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(20, 92, 55, 0.12)" />
                                    <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} height={60} angle={-18} textAnchor="end" />
                                    <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value) => formatMoney(value)} />
                                    <Bar dataKey="total" radius={[12, 12, 0, 0]}>
                                        {summary.categoryTotals.slice(0, 8).map((entry, index) => (
                                            <Cell key={`cell-${entry.category}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className={styles.chartCard}>
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={summary.placeTotals.slice(0, 6)} dataKey="total" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={4}>
                                        {summary.placeTotals.slice(0, 6).map((entry, index) => (
                                            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatMoney(value)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>
            </div>

            <div className={styles.twoColumnGrid}>
                <section className={styles.sectionBlock}>
                    <SectionHeader
                        title="Known spend places"
                        subtitle="Auto-built from logs. These are the places you visit most often."
                    />
                    <div className={styles.placeList}>
                        {summary.placeTotals.map((place) => (
                            <div className={styles.placeCard} key={place.name}>
                                <strong>{place.name}</strong>
                                <p>{place.count} visits</p>
                                <span>{formatMoney(place.total)}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.sectionBlock}>
                    <SectionHeader
                        title="Recent activity"
                        subtitle="A clean ledger of what changed most recently."
                    />
                    <div className={styles.transactionList}>
                        {summary.recentTransactions.map((transaction) => (
                            <div className={styles.transactionCard} key={transaction._id}>
                                <div>
                                    <strong>{transaction.description || transaction.placeName || transaction.category}</strong>
                                    <p>
                                        {transaction.category} · {transaction.paymentMethod} · {transaction.account?.name || "Account"}
                                        {transaction.transferToAccount ? ` → ${transaction.transferToAccount.name}` : ""}
                                    </p>
                                </div>
                                <div className={styles.transactionMeta}>
                                    <span className={transaction.type === "expense" ? styles.debit : styles.credit}>
                                        {transaction.type === "expense" ? "-" : "+"}{formatMoney(transaction.amount)}
                                    </span>
                                    <small>{formatDate(transaction.transactionDate)}</small>
                                    <div className={styles.cardActions}>
                                        <button type="button" onClick={() => handleEditTransaction(transaction)}>Edit</button>
                                        <button type="button" className={styles.dangerButton} onClick={() => handleDeleteTransaction(transaction._id)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}