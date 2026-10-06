import api from "./api";

const expenseService = {
    getSummary() {
        return api.get("/expenses/summary").then((response) => response.data);
    },
    getAccounts() {
        return api.get("/expenses/accounts").then((response) => response.data);
    },
    updateAccount(id, payload) {
        return api.put(`/expenses/accounts/${id}`, payload).then((response) => response.data);
    },
    getTransactions() {
        return api.get("/expenses/transactions").then((response) => response.data);
    },
    createTransaction(payload) {
        return api.post("/expenses/transactions", payload).then((response) => response.data);
    },
    deleteTransaction(id) {
        return api.delete(`/expenses/transactions/${id}`).then((response) => response.data);
    },
    updateTransaction(id, payload) {
        return api.put(`/expenses/transactions/${id}`, payload).then((response) => response.data);
    },
    getSubscriptions() {
        return api.get("/expenses/subscriptions").then((response) => response.data);
    },
    createSubscription(payload) {
        return api.post("/expenses/subscriptions", payload).then((response) => response.data);
    },
    updateSubscription(id, payload) {
        return api.put(`/expenses/subscriptions/${id}`, payload).then((response) => response.data);
    },
    deleteSubscription(id) {
        return api.delete(`/expenses/subscriptions/${id}`).then((response) => response.data);
    },
    getBudgets() {
        return api.get("/expenses/budgets").then((response) => response.data);
    },
    upsertBudget(payload) {
        return api.post("/expenses/budgets", payload).then((response) => response.data);
    },
    exportMonthlyCsv(month) {
        return api.get("/expenses/export", { params: { month }, responseType: "blob" });
    },
    getPlaces(search = "") {
        const params = search ? { search } : {};
        return api.get("/expenses/places", { params }).then((response) => response.data);
    },
};

export default expenseService;