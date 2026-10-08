import { createContext, useState, useEffect } from "react";
import authService from "../services/authService";
import {
    setAccessToken,
    clearAccessToken,
    getAccessToken,
    isSessionExpiredError,
} from "../services/api";
import gamificationService from "../services/gamificationService";

const AUTH_USER_STORAGE_KEY = "life-management.authUser";

const readStoredUser = () => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
        return storedUser ? JSON.parse(storedUser) : null;
    } catch {
        return null;
    }
};

const storeUser = (user) => {
    if (typeof window === "undefined") {
        return;
    }

    if (user) {
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
        window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState(null);
    const [levelInfo, setLevelInfo] = useState({
        level: 1,
        currentXp: 0,
        xpForNext: 100,
        totalXp: 0,
        coins: 0,
    });

    // Helper functions
    const clearAuthState = () => {
        setIsAuthenticated(false);
        setUser(null);
        clearAccessToken();
        storeUser(null);
    };

    const applyAuthResponse = (response) => {
        const accessToken = response?.accessToken;
        const currentUser = response?.user || response?.data?.user || response?.data || null;

        if (accessToken) {
            setAccessToken(accessToken);
        }

        if (currentUser) {
            setUser(currentUser);
            storeUser(currentUser);
        }

        setIsAuthenticated(true);
    };

    const fetchGamificationStats = async () => {
        const stats = await gamificationService.getStats();
        if (stats) {
            setLevelInfo(stats);
        }
    };

    // Register
    const register = async (userData) => {
        try {
            setAuthLoading(true);
            setError(null);

            const response = await authService.register(userData);

            // With email confirmation on, signing up doesn't sign in:
            // the account opens once the link in the email has been clicked
            if (!response.accessToken) {
                return {
                    success: true,
                    verificationRequired: true,
                    email: response.email,
                };
            }

            applyAuthResponse(response);

            // Fetch gamification stats immediately after successful registration
            await fetchGamificationStats();

            return { success: true, data: user };
        } catch (err) {
            setError(err.message || "Registration failed");
            throw err;
        } finally {
            setAuthLoading(false);
        }
    };

    // Login
    const login = async (credentials) => {
        try {
            setAuthLoading(true);
            setError(null);

            const response = await authService.login(credentials);
            applyAuthResponse(response);

            // Fetch gamification stats immediately after successful login
            await fetchGamificationStats();

            return { success: true };
        } catch (err) {
            const message = err.message || "Login failed";
            setError(message);
            throw err;
        } finally {
            setAuthLoading(false);
        }
    };

    // Logout
    const logout = async () => {
        try {
            setAuthLoading(true);

            await authService.logout();
            clearAuthState();

            return { success: true };
        } catch (err) {
            clearAuthState();
            return { success: false, message: err.message || "Logout failed" };
        } finally {
            setAuthLoading(false);
        }
    };

    // Logout from all devices
    const logoutAll = async () => {
        try {
            setAuthLoading(true);

            await authService.logoutAll();
            clearAuthState();

            return { success: true };
        } catch (err) {
            clearAuthState();
            return { success: false, message: err.message || "Logout failed" };
        } finally {
            setAuthLoading(false);
        }
    };

    // This runs on app load to check if user is still logged in
    const checkAuthStatus = async () => {
        const cachedToken = getAccessToken();
        const cachedUser = readStoredUser();

        if (cachedToken) {
            setAccessToken(cachedToken);
            setIsAuthenticated(true);
        }

        if (cachedUser) {
            setUser(cachedUser);
        }

        try {
            const response = await authService.refreshToken();
            if (response.accessToken) {
                applyAuthResponse(response);

                // Fetch gamification stats immediately upon confirming active session
                await fetchGamificationStats();
            }
        } catch (err) {
            // The server rejected the refresh token, so the session is really over.
            // Any other failure (offline, server waking up) keeps the cached session;
            // the api interceptor refreshes again on the next request.
            if (!cachedToken || isSessionExpiredError(err.cause)) {
                clearAuthState();
            }
        } finally {
            setLoading(false);
        }
    };

    // Initialize auth check on app load
    useEffect(() => {
        const initializeAuth = async () => {
            await checkAuthStatus();
        };

        initializeAuth();

        const handleLogoutEvent = () => {
            clearAuthState();
        };

        window.addEventListener("auth:logout", handleLogoutEvent);

        return () => {
            window.removeEventListener("auth:logout", handleLogoutEvent);
        };
    }, []);

    // Context value
    const value = {
        // State
        user,
        isAuthenticated,
        loading,
        authLoading,
        error,
        levelInfo, // <-- Added to context

        // Actions
        register,
        login,
        logout,
        logoutAll,
        checkAuthStatus,
        fetchGamificationStats, // <-- Added to context
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                }}
            >
                <h2>Loading...</h2>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export { AuthContext };
