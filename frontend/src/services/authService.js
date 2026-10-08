import api, { authApi, refreshSession } from "./api";

const authService = {
    register: async (data) => {
        try {
            const response = await authApi.post("/auth/register", data);
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
            const response = await authApi.post("/auth/login", credentials);
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
            return await refreshSession(); // shared with the api interceptor, never run twice in parallel
        } catch (error) {
            throw new Error("Session expired. Please login again.", {
                cause: error,
            });
        }
    },
    verifyEmail: async (token) => {
        try {
            const response = await authApi.post(`/auth/verify-email/${token}`);
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "We couldn't confirm your email. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    resendVerification: async (email) => {
        try {
            const response = await authApi.post("/auth/resend-verification", {
                email,
            });
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to send the confirmation email. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    forgotPassword: async (email) => {
        try {
            const response = await authApi.post("/auth/forgot-password", {
                email,
            });
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to send reset link. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
    resetPassword: async (token, password) => {
        try {
            const response = await authApi.post(
                `/auth/reset-password/${token}`,
                {
                    password,
                },
            );
            return response.data;
        } catch (error) {
            const message =
                error.response?.data?.message ||
                "Failed to reset password. Please try again.";
            throw new Error(message, { cause: error });
        }
    },
};

export default authService;
