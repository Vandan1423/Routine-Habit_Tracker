import api from "./api";

// Days that have ended, read back: nothing here changes anything. Each call throws when it fails,
// so the screen that asked can say so and offer to try again.
const read = async (path, params, fallback) => {
    try {
        const response = await api.get(path, { params });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const historyService = {
    // The summary of each day from one date to another (both "YYYY-MM-DD", both included, a year at most)
    getDays: (from, to) => read("/history/days", { from, to }, "Failed to fetch the days."),

    // One ended day, item by item
    getDay: (date) => read(`/history/days/${date}`, undefined, "Failed to fetch the day."),

    // How each routine and habit went over a stretch of days
    getItems: (from, to) => read("/history/items", { from, to }, "Failed to fetch how each item went."),

    // How each routine and habit stood on each day of a stretch: done, late, partly done or missed
    getMarks: (from, to) => read("/history/marks", { from, to }, "Failed to fetch the week's marks."),

    // The XP ledger, newest first. `before` is the `next` of the page already held.
    getLedger: ({ before, limit } = {}) =>
        read("/history/ledger", { before, limit }, "Failed to fetch the ledger."),
};

export default historyService;
