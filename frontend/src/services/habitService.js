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
};

export default habitService;
