import api from "./api"; 

const habitService = {
    getHabits: async () => {
        try {
            const response = await api.get("/habits");
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to fetch habits. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    createHabit: async (data) => {
        try {
            const response = await api.post("/habits", data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to create habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    updateHabit: async (id, data) => {
        try {
            const response = await api.put(`/habits/${id}`, data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to update habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    deleteHabit: async (id) => {
        try {
            const response = await api.delete(`/habits/${id}`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to delete habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Brings back a habit that was deleted
    restoreHabit: async (id) => {
        try {
            const response = await api.post(`/habits/${id}/restore`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to restore habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Expected data format: { habits: [ { id: "...", order: 0 }, ... ] }
    reorderHabits: async (data) => {
        try {
            const response = await api.put("/habits/reorder", data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to reorder habits. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // The days a habit was done, partly done or missed, with its totals and runs
    getHistory: async (id) => {
        try {
            const response = await api.get(`/habits/${id}/history`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to fetch the habit's history. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    logHabit: async (id, data = {}) => {
        try {
            // data can contain { quantity, note, date }
            const response = await api.post(`/habits/${id}/log`, data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to log habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Sets today's count outright: 0 clears the day, the target (or more) completes it.
    // Sending the same count twice changes nothing, so it is safe to send again after a failure.
    setHabitLog: async (id, quantity) => {
        try {
            const response = await api.put(`/habits/${id}/log`, { quantity });
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to update habit. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
};

export default habitService;
