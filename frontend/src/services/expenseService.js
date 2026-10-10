import api from "./api";
import { write } from "./outbox";
import { joinPages, PAGE_SIZE } from "../lib/expenses";

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

// One page of a month's transactions, newest first. Page 0 is the latest of them.
const readPage = (month, page) =>
    call(
        () => api.get("/expenses/transactions", { params: { month, limit: PAGE_SIZE, offset: page * PAGE_SIZE } }),
        "Failed to fetch the transactions.",
    );

const expenseService = {
    /**
     * One month ("YYYY-MM") as the Expenses screen shows it: its summary, and the latest of its transactions.
     * @param {Number} pages - how many pages of the transactions to read
     * @returns {Object} - summary; transactions: the ones read; total: how many the month has in all
     */
    getMonth: async (month, pages = 1) => {
        const [summary, ...lists] = await Promise.all([
            call(() => api.get("/expenses/summary", { params: { month } }), "Failed to fetch the month."),
            ...Array.from({ length: pages }, (_, page) => readPage(month, page)),
        ]);

        return {
            summary,
            transactions: joinPages(...lists.map((list) => list.transactions ?? [])),
            total: lists[0].total ?? 0,
        };
    },

    // The page after the ones already read: { transactions, total }
    getTransactions: readPage,

    // name and openingBalance are what can be changed
    updateAccount: (id, data) => call(() => api.put(`/expenses/accounts/${id}`, data), NOT_SAVED),

    // These are on screen before they are sent, so they go through the outbox. `key` is the new thing's
    // own (newKey), so that sending it twice still makes one.
    createTransaction: (data, key) => call(() => write("post", "/expenses/transactions", data, { key }), NOT_SAVED),
    updateTransaction: (id, data) => call(() => write("put", `/expenses/transactions/${id}`, data), NOT_SAVED),
    deleteTransaction: (id) => call(() => write("delete", `/expenses/transactions/${id}`), "It couldn’t be deleted."),

    createSubscription: (data, key) => call(() => write("post", "/expenses/subscriptions", data, { key }), NOT_SAVED),
    updateSubscription: (id, data) => call(() => write("put", `/expenses/subscriptions/${id}`, data), NOT_SAVED),
    deleteSubscription: (id) => call(() => write("delete", `/expenses/subscriptions/${id}`), "It couldn’t be deleted."),

    // Sets a category's monthly limit, or takes it away (isActive: false). A category has one limit, so
    // sending this twice changes nothing.
    saveBudget: (data) => call(() => write("post", "/expenses/budgets", data, { again: true }), NOT_SAVED),

    // One month's transactions as a spreadsheet file
    exportMonth: (month) =>
        call(() => api.get("/expenses/export", { params: { month }, responseType: "blob" }), "The export failed."),
};

export default expenseService;
