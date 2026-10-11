import api from "./api";

// Archive: the routines and habits that have been retired. Bringing one back, or deleting it, goes through
// the routine's or habit's own service.
const archiveService = {
    // { routines, habits }: each as the plan's routes send it, with timesDone; the most recently retired first
    getArchive: async () => {
        try {
            const response = await api.get("/archive");
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to fetch Archive.", { cause: error });
        }
    },
};

export default archiveService;
