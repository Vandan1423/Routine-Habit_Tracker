import api from "./api";
import { write } from "./outbox";

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

    // Shown before it is sent (see services/outbox.js). `key` is the new routine's own, so sending it twice makes one.
    createRoutine: async (data, key) => {
        try {
            const response = await write("post", "/routines", data, { key });
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
            const response = await write("put", `/routines/${id}`, data);
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

    // Retires a routine to Archive: out of the plan, history kept, to be brought back any time
    archiveRoutine: async (id) => {
        try {
            const response = await api.post(`/routines/${id}/archive`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to retire routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Brings a retired routine back from Archive into the plan
    unarchiveRoutine: async (id) => {
        try {
            const response = await api.post(`/routines/${id}/unarchive`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to bring the routine back. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Pauses a routine: { days, from } (from: "YYYY-MM-DD", today when left out)
    pauseRoutine: async (id, data) => {
        try {
            const response = await api.post(`/routines/${id}/pause`, data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to pause routine. Please try again.";
            throw new Error(message, { cause: error });
        }
    },

    // Ends a routine's pause early: due again from today
    resumeRoutine: async (id) => {
        try {
            const response = await api.delete(`/routines/${id}/pause`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to resume routine. Please try again.";
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
