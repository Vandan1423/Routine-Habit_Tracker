import api from "./api"; 

const streakService = {
    getInfo: async () => {
        try {
            const response = await api.get("/streaks/info");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch streak info:", error);
            return null;
        }
    },

    // The days that ended recently, with what was left undone on each and what that cost.
    // Answers null rather than failing: Today is whole without it.
    getRecap: async () => {
        try {
            const response = await api.get("/streaks/recap");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch the recap:", error);
            return null;
        }
    },
};

export default streakService;
