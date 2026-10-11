import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import authService from "../services/authService";
import {
    setAccessToken,
    clearAccessToken,
    getAccessToken,
    isSessionExpiredError,
} from "../services/api";
import gamificationService from "../services/gamificationService";
import { clearFetched } from "../hooks/useFetched";
import { releaseDevice } from "../lib/notify";
import { adoptEarlierNames } from "../lib/remembered";

const AUTH_USER_STORAGE_KEY = "nityakram.authUser";

// Whoever was signed in before the app had this name is still known under the new one
if (typeof window !== "undefined") {
    adoptEarlierNames();
}

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

// Every address waits for the session check unless told otherwise
const always = () => true;

// fallback: what is shown while the session is being checked, in place of the app
// needsSession(pathname, signedIn): whether the page at this address has to wait for that check. Pages that
//     read nothing of the account (a link from an email, the sign-in form of a visitor with no session
//     in this browser) are shown at once, and the check carries on behind them.
export const AuthProvider = ({ children, fallback = null, needsSession = always }) => {
    const { pathname } = useLocation();
    // Both start from what the last visit left in this browser, so the very first paint already knows
    // whether someone is probably signed in. The server confirms or corrects it in checkAuthStatus.
    const [user, setUser] = useState(readStoredUser);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAccessToken()));
    const [error, setError] = useState(null);
    const [levelInfo, setLevelInfo] = useState({
        level: 1,
        currentXp: 0,
        xpForNext: 100,
        totalXp: 0,
        coins: 0,
    });
    // False until the server has sent the real numbers; until then levelInfo holds the placeholders above
    const [levelLoaded, setLevelLoaded] = useState(false);
    // Set when someone signs in (or up) while the first check is still on its way, so that the check's
    // own answer, which is about the session from before, cannot undo it
    const signedInSince = useRef(false);
    // True once the person has left by their own choice (signed out, deleted the account), as against a
    // session that ran out: only the second is sent back to where it was after signing in again
    const [left, setLeft] = useState(false);

    // Helper functions
    const clearAuthState = ({ byChoice = false } = {}) => {
        setLeft(byChoice);
        setIsAuthenticated(false);
        setUser(null);
        setLevelLoaded(false);
        clearAccessToken();
        storeUser(null);
        clearFetched();
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
        setLeft(false);
    };

    // Answers with the numbers it fetched (null if it could not), for a caller that wants to compare before and after
    const fetchGamificationStats = async () => {
        const stats = await gamificationService.getStats();
        if (stats) {
            setLevelInfo(stats);
            setLevelLoaded(true);
        }
        return stats;
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

            signedInSince.current = true;
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
            signedInSince.current = true;
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

            // Reminders for this account stop coming to this device. Asked first, while the session can still ask.
            await releaseDevice().catch(() => {});
            await authService.logout();
            clearAuthState({ byChoice: true });

            return { success: true };
        } catch (err) {
            clearAuthState({ byChoice: true });
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
            clearAuthState({ byChoice: true });

            return { success: true };
        } catch (err) {
            clearAuthState({ byChoice: true });
            return { success: false, message: err.message || "Logout failed" };
        } finally {
            setAuthLoading(false);
        }
    };

    // ── Changes to the account itself (Settings). Each one throws what authService throws, for the form to show. ──

    const keepUser = useCallback((nextUser) => {
        if (nextUser) {
            setUser(nextUser);
            storeUser(nextUser);
        }
        return nextUser;
    }, []);

    // The account as the server holds it now: the cached copy can be days old (its timezone, for one)
    const refreshUser = useCallback(
        async () => keepUser((await authService.getMe()).user),
        [keepUser],
    );

    const updateProfile = async (data) => keepUser((await authService.updateProfile(data)).user);

    // The other devices are signed out by the server; this one carries on
    const changePassword = (currentPassword, newPassword) =>
        authService.changePassword({ currentPassword, newPassword });

    // Gone for good. What this browser held of the session goes with it.
    const deleteAccount = async (password) => {
        await authService.deleteAccount({ password });
        clearAuthState({ byChoice: true });
    };

    // The server has ended every session of this account (a password reset does), so this browser lets go of its own
    const forgetSession = () => {
        signedInSince.current = false;
        clearAuthState({ byChoice: true });
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
            // Someone who signed in while this was on its way has a new session, which this says nothing about.
            if (!signedInSince.current && (!cachedToken || isSessionExpiredError(err.cause))) {
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
        levelLoaded,
        left,

        // Actions
        register,
        login,
        logout,
        logoutAll,
        checkAuthStatus,
        fetchGamificationStats, // <-- Added to context
        refreshUser,
        updateProfile,
        changePassword,
        deleteAccount,
        forgetSession,
    };

    // Nothing of the app renders until the check is over: the screens and the providers of today and the plan
    // all assume the session is settled by the time they mount. The pages that need no session do not wait.
    const waiting = loading && needsSession(pathname, isAuthenticated);

    return (
        <AuthContext.Provider value={value}>{waiting ? fallback : children}</AuthContext.Provider>
    );
};

export { AuthContext };
