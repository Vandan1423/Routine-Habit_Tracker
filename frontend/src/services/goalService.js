import api from "./api";
import { write } from "./outbox";

// Goals. Each call throws when it fails, with the server's own words where it gave any.
// Bringing a deleted goal back is trashService's work.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const NOT_SAVED = "It couldn’t be saved.";

const goalService = {
    // { today, goals }: the ones still open first, the soonest date first
    getGoals: () => call(() => api.get("/goals"), "Failed to fetch the goals."),

    // These are on screen before they are sent, so they go through the outbox. `key` is the new goal's
    // own (newKey), so that sending it twice still makes one.
    createGoal: async (data, key) => (await call(() => write("post", "/goals", data, { key }), NOT_SAVED)).goal,
    // title, note, targetDate, milestones, links and reached are what can be changed
    updateGoal: async (id, data) => (await call(() => write("put", `/goals/${id}`, data), NOT_SAVED)).goal,
    setMilestone: async (id, milestoneId, done) =>
        (await call(() => write("put", `/goals/${id}/milestones/${milestoneId}`, { done }), NOT_SAVED)).goal,
    deleteGoal: (id) => call(() => write("delete", `/goals/${id}`), "It couldn’t be deleted."),
};

export default goalService;
