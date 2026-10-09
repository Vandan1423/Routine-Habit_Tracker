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

    // Every routine in the plan, whatever day it falls on: the repeating ones and the one-off tasks still to come
    getAllRoutines: async () => {
        try {
            const response = await api.get("/routines/all");
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to fetch routines. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // The days a routine was done, done late or missed, with its totals and runs
    getHistory: async (id) => {
        try {
            const response = await api.get(`/routines/${id}/history`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to fetch the routine's history. Please try again.";
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

    // Brings back a routine that was deleted
    restoreRoutine: async (id) => {
        try {
            const response = await api.post(`/routines/${id}/restore`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to restore routine. Please try again.";
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

    // No date: the server records it for the user's own today, at the time on its own clock.
    // With one, it refuses unless that is still today: a tick meant for a day that has since ended is not moved to the next.
    completeRoutine: async (id, date) => {
        try {
            const response = await api.post(`/routines/${id}/complete`, date ? { date } : {});
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to complete routine. Please try again.";
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
