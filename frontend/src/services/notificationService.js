import api from "./api";

// The devices an account gets reminders on (see lib/notify.js for this device's side of it)
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const notificationService = {
    // { publicKey }: what a browser subscribes with, or null when the server sends no push messages
    getConfig: () => call(() => api.get("/notifications/config"), "Couldn’t reach the server."),

    // subscription: a PushSubscription, as its toJSON() gives it
    subscribe: (subscription) =>
        call(() => api.post("/notifications/subscriptions", { subscription }), "Reminders couldn’t be turned on."),

    unsubscribe: (endpoint) =>
        call(() => api.delete("/notifications/subscriptions", { data: { endpoint } }), "Reminders couldn’t be turned off."),

    // A reminder sent now to every device of the account
    test: () => call(() => api.post("/notifications/test"), "The test reminder wasn’t sent."),
};

export default notificationService;
