import api from "./api";
import { write } from "./outbox";

// What a week is for beyond its days: its focus, notes and review, kept under the week's first day.
// Each call throws when it fails, with the server's own words where it gave any. A write is shown first
// and sent after, so it goes through the outbox; each one sends whole fields, so sending it twice is harmless.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const weekService = {
    // { start, focus: [{ _id, title, done, goal }], notes, wentWell, better }
    getWeek: async (start) => (await call(() => api.get(`/weeks/${start}`), "Failed to fetch the week.")).week,

    // Any of focus ([{ _id?, title, done, goalId }]), notes, wentWell and better
    saveWeek: async (start, data) =>
        (await call(() => write("put", `/weeks/${start}`, data), "It couldn’t be saved.")).week,
};

export default weekService;
