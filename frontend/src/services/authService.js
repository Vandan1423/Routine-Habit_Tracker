import api from "./api";

const authService = {
    register: async (data) => {
        try {
            const response = await api.post("/auth/register", data);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Registration failed. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    login: async (credentials) => {
        try {
            const response = await api.post("/auth/login", credentials);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Login failed. Please check credentials.";
            throw new Error(message, { cause: error });
        }
    },
    logout: async () => {
        try {
            const response = await api.post("/auth/logout");
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Logout failed. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    logoutAll: async () => {
        try {
            const response = await api.post("/auth/logout-all");
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Logout from all devices failed. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    refreshToken: async () => {
        try {
            const response = await api.post("/auth/refresh-token");
            return response.data;
        } catch (error) {
            throw new Error("Session expired. Please login again.", { cause: error });
        }
    },
};

export default authService;
