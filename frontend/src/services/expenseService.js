import api from "./api";

// Money: accounts, transactions, limits and subscriptions. Each call throws when it fails, with the
// server's own words where it gave any, so the screen that asked can say so.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const NOT_SAVED = "It couldn’t be saved.";

const expenseService = {
    // One month ("YYYY-MM") as the Expenses screen shows it: its summary, and every transaction in it
    getMonth: async (month) => {
        const [summary, list] = await Promise.all([
            call(() => api.get("/expenses/summary", { params: { month } }), "Failed to fetch the month."),
            call(() => api.get("/expenses/transactions", { params: { month } }), "Failed to fetch the transactions."),
        ]);

        return { summary, transactions: list.transactions ?? [] };
    },

    // name and openingBalance are what can be changed
    updateAccount: (id, data) => call(() => api.put(`/expenses/accounts/${id}`, data), NOT_SAVED),

    createTransaction: (data) => call(() => api.post("/expenses/transactions", data), NOT_SAVED),
    updateTransaction: (id, data) => call(() => api.put(`/expenses/transactions/${id}`, data), NOT_SAVED),
    deleteTransaction: (id) => call(() => api.delete(`/expenses/transactions/${id}`), "It couldn’t be deleted."),

    createSubscription: (data) => call(() => api.post("/expenses/subscriptions", data), NOT_SAVED),
    updateSubscription: (id, data) => call(() => api.put(`/expenses/subscriptions/${id}`, data), NOT_SAVED),
    deleteSubscription: (id) => call(() => api.delete(`/expenses/subscriptions/${id}`), "It couldn’t be deleted."),

    // Sets a category's monthly limit, or takes it away (isActive: false)
    saveBudget: (data) => call(() => api.post("/expenses/budgets", data), NOT_SAVED),

    // One month's transactions as a spreadsheet file
    exportMonth: (month) =>
        call(() => api.get("/expenses/export", { params: { month }, responseType: "blob" }), "The export failed."),
};

export default expenseService;
