import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

//Now store the access token into the memory
let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};
export const clearAccessToken = () => {
    accessToken = null;
};
export const getAccessToken = () => accessToken;

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
    }
);

//Add response interceptor to handle token expiration automatically
let isRefreshing = false;
let failedRequestsQueue = [];

api.interceptors.response.use(
    // If response is successful, just return it
    (response) => {
        return response;
    },

    // If error occurs, which includes token expiration
    async (error) => {
        const originalRequest = error.config;

        //Access token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;

                try {
                    const response = await axios.post(
                        `${api.defaults.baseURL}/auth/refresh-token`,
                        {},
                        { withCredentials: true } // Send cookies
                    );

                    const newAccessToken = response.data.accessToken;
                    setAccessToken(newAccessToken);

                    // Update the failed request with new token
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                    // Retry All Failed Requests
                    failedRequestsQueue.forEach((callback) =>
                        callback(newAccessToken)
                    );
                    failedRequestsQueue = [];

                    // Retry the original request
                    return api(originalRequest);
                } catch (refreshError) {
                    // Clear everything and logout
                    clearAccessToken();
                    failedRequestsQueue = [];

                    // Redirect to login (we'll handle this in AuthContext)
                    window.dispatchEvent(new Event("auth:logout"));

                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            // If a refresh is already in progress, queue this request
            return new Promise((resolve) => {
                failedRequestsQueue.push((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    resolve(api(originalRequest));
                });
            });
        }
        return Promise.reject(error);
    }
);

export default api;
