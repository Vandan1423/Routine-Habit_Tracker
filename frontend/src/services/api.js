import axios from "axios";
import { adoptStored } from "../lib/remembered";

// Defaults to the same-origin /api path, which the Vite dev server proxies to the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// The device's timezone goes out with every request, so the server knows when this user's day starts and ends
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    ...(TIMEZONE ? { "X-Timezone": TIMEZONE } : {}),
};

// Separate instance for refresh — bypasses the response interceptor to avoid infinite loops
export const authApi = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: DEFAULT_HEADERS,
});

const ACCESS_TOKEN_STORAGE_KEY = "nitya.accessToken";

// A session from before the app was called Nitya carries on under the new name
if (typeof window !== "undefined") {
    adoptStored(ACCESS_TOKEN_STORAGE_KEY, "life-management.accessToken");
}

const readStoredAccessToken = () => {
    if (typeof window === "undefined") {
        return null;
    }

    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 15000,
    headers: DEFAULT_HEADERS,
});

//Now store the access token into the memory
let accessToken = readStoredAccessToken();

export const setAccessToken = (token) => {
    accessToken = token;

    if (typeof window === "undefined") {
        return;
    }

    if (token) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
};
export const clearAccessToken = () => {
    setAccessToken(null);
};
export const getAccessToken = () => {
    if (!accessToken) {
        accessToken = readStoredAccessToken();
    }

    return accessToken;
};

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === ACCESS_TOKEN_STORAGE_KEY) {
            accessToken = event.newValue;
        }
    });
}

//Api request Interceptor to add the access token to the headers (Config is the request object)
api.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Only one refresh may be in flight at a time. Every caller (app load, any request that hit a 401)
// shares the same request, so this tab never spends the rotating refresh token twice.
let refreshPromise = null;

export const refreshSession = () => {
    if (!refreshPromise) {
        refreshPromise = authApi
            .post("/auth/refresh-token")
            .then((response) => {
                setAccessToken(response.data.accessToken);
                return response.data;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

// True when the server itself rejected the refresh token, as opposed to a network error,
// a timeout or a 5xx — those say nothing about whether the session is still valid.
export const isSessionExpiredError = (error) => {
    const status = error?.response?.status;
    return status === 401 || status === 403;
};

//Add response interceptor to handle token expiration automatically
api.interceptors.response.use(
    // If response is successful, just return it
    (response) => {
        return response;
    },

    // If error occurs, which includes token expiration
    async (error) => {
        const originalRequest = error.config;

        //Access token expired
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;

            try {
                const { accessToken: newAccessToken } = await refreshSession();

                // Retry the original request with the new token
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Only end the session when the refresh token was rejected. A network blip
                // or a server that is still waking up must not log the user out.
                if (isSessionExpiredError(refreshError)) {
                    clearAccessToken();

                    // Redirect to login (we'll handle this in AuthContext)
                    window.dispatchEvent(new Event("auth:logout"));
                }

                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    },
);

export default api;
