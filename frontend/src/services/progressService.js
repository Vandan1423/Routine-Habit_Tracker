import api from "./api";

const progressService = {
    // --- Gamification Data ---
    getGamificationStats: async () => {
        try {
            const response = await api.get("/gamification/stats");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch gamification stats:", error);
            return null; // Return null to handle graceful fallbacks in the UI
        }
    },

    getXPHistory: async () => {
        try {
            const response = await api.get("/gamification/xp-history");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch XP history:", error);
            return { history: [] };
        }
    },

    // --- Streak & Performance Data ---
    getStreakInfo: async () => {
        try {
            const response = await api.get("/streaks/info");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch streak info:", error);
            return null;
        }
    },

    getDailyLogs: async (days = 30) => {
        try {
            const response = await api.get(`/streaks/logs?days=${days}`);
            return response.data;
        } catch (error) {
            console.error(
                `Failed to fetch daily logs for last ${days} days:`,
                error,
            );
            return { logs: [] };
        }
    },
};

export default progressService;
