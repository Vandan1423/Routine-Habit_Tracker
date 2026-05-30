import { createContext, useState, useEffect } from "react";
import authService from "../services/authService";
import { setAccessToken, clearAccessToken } from "../services/api";
import gamificationService from "../services/gamificationService";

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
            const { user, accessToken } = response;
            setAccessToken(accessToken);
            setUser(user);
            setIsAuthenticated(true);

            // Fetch gamification stats immediately after successful registration
            await fetchGamificationStats();

            return { success: true, data: user };
        } catch (err) {
            setError(err.message || "Registration failed");
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
            const { accessToken } = response;

            setAccessToken(accessToken);
            setUser(response.user || response.data || null);
            setIsAuthenticated(true);

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
        try {
            const response = await authService.refreshToken();
            if (response.accessToken) {
                setAccessToken(response.accessToken);
                setUser(response.data);
                setIsAuthenticated(true);

                // Fetch gamification stats immediately upon confirming active session
                await fetchGamificationStats();
            }
        } catch {
            clearAuthState();
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
