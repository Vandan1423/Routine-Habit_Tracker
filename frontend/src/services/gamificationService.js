import api from "./api";

const gamificationService = {
    getStats: async () => {
        try {
            const response = await api.get("/gamification/stats");
            return response.data;
        } catch (error) {
            console.error("Failed to fetch gamification stats:", error);
            return null;
        }
    },
};

export default gamificationService;
