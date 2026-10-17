import api from "./api";

// The Claude connector: the person's answer when Claude asks to be let in, and the connections Settings lists.
// Each call throws when it fails, with the server's own words where it gave any.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw Object.assign(new Error(error.response?.data?.message || fallback, { cause: error }), {
            status: error.response?.status,
        });
    }
};

const connectorService = {
    // The answer on the Connect page, with the request it was given: { redirectTo }, where to send the person
    decide: (request, approve) =>
        call(() => api.post("/oauth/authorize", { ...request, approve }), "Your answer didn’t reach the server. Try again."),

    // { url, connections }: the address to add in Claude, and the apps let in, the newest first
    getConnections: () => call(() => api.get("/connections"), "Connected apps couldn’t be loaded."),

    // Ends one at once: Claude has to be allowed in again to use the app
    disconnect: (id) => call(() => api.delete(`/connections/${id}`), "Claude couldn’t be disconnected. Try again."),
};

export default connectorService;
