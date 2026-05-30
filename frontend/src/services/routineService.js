import api from "./api";

const routineService = {
    getRoutines: async (date = null) => {
        try {
            // If a date is passed (e.g., "2026-05-29"), append it to the query string.
            const url = date ? `/routines?date=${date}` : "/routines";
            const response = await api.get(url);

            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to fetch routines. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    createRoutine: async (data) => {
        try {
            const response = await api.post("/routines", data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to create routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    updateRoutine: async (id, data) => {
        try {
            const response = await api.put(`/routines/${id}`, data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to update routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    deleteRoutine: async (id) => {
        try {
            const response = await api.delete(`/routines/${id}`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to delete routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    reorderRoutines: async (data) => {
        try {
            // Expected data format: { routines: [ { id: "...", order: 0 }, ... ] }
            const response = await api.put("/routines/reorder", data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to reorder routines. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    uncompleteRoutine: async (id, date) => {
        try {
            const response = await api.delete(`/routines/${id}/complete`, {
                data: { date },
            });
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to uncomplete routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
};

export default routineService;
