import api, { authApi, refreshSession } from "./api";

// What a failed account request is turned into: the server's own words where it sent any, with its
// `code` ("WRONG_PASSWORD") and the HTTP status alongside for a form that wants to place the message
const failure = (error, fallback) =>
    Object.assign(new Error(error.response?.data?.message || fallback, { cause: error }), {
        code: error.response?.data?.code,
        status: error.response?.status,
    });

const authService = {
    register: async (data) => {
        try {
            const response = await authApi.post("/auth/register", data);
            return response.data;
        } catch (error) {
            throw failure(error, "Your account wasn’t created. Please try again.");
        }
    },
    login: async (credentials) => {
        try {
            const response = await authApi.post("/auth/login", credentials);
            return response.data;
        } catch (error) {
            throw failure(error, "You weren’t signed in. Please try again.");
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
    getMe: async () => {
        try {
            const response = await api.get("/auth/me");
            return response.data;
        } catch (error) {
            throw failure(error, "Your account didn’t load. Please try again.");
        }
    },
    updateProfile: async (data) => {
        try {
            const response = await api.put("/auth/me", data);
            return response.data;
        } catch (error) {
            throw failure(error, "That didn’t save. Please try again.");
        }
    },
    changePassword: async (data) => {
        try {
            const response = await api.put("/auth/password", data);
            return response.data;
        } catch (error) {
            throw failure(error, "Your password wasn’t changed. Please try again.");
        }
    },
    deleteAccount: async (data) => {
        try {
            const response = await api.post("/auth/delete-account", data);
            return response.data;
        } catch (error) {
            throw failure(error, "Your account wasn’t deleted. Please try again.");
        }
    },
    verifyEmail: async (token) => {
        try {
            const response = await authApi.post(`/auth/verify-email/${token}`);
            return response.data;
        } catch (error) {
            throw failure(error, "Your email wasn’t confirmed. Please try again.");
        }
    },
    resendVerification: async (email) => {
        try {
            const response = await authApi.post("/auth/resend-verification", {
                email,
            });
            return response.data;
        } catch (error) {
            throw failure(error, "The link wasn’t sent. Please try again.");
        }
    },
    forgotPassword: async (email) => {
        try {
            const response = await authApi.post("/auth/forgot-password", {
                email,
            });
            return response.data;
        } catch (error) {
            throw failure(error, "The link wasn’t sent. Please try again.");
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
            throw failure(error, "Your password wasn’t changed. Please try again.");
        }
    },
};

export default authService;
