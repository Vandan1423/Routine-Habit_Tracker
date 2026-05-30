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
};

export default streakService;