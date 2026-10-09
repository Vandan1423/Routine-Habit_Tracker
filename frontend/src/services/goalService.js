import api from "./api";

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

    createGoal: async (data) => (await call(() => api.post("/goals", data), NOT_SAVED)).goal,
    // title, note, targetDate, milestones, links and reached are what can be changed
    updateGoal: async (id, data) => (await call(() => api.put(`/goals/${id}`, data), NOT_SAVED)).goal,
    setMilestone: async (id, milestoneId, done) =>
        (await call(() => api.put(`/goals/${id}/milestones/${milestoneId}`, { done }), NOT_SAVED)).goal,
    deleteGoal: (id) => call(() => api.delete(`/goals/${id}`), "It couldn’t be deleted."),
};

export default goalService;
