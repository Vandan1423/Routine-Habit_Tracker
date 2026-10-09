import api from "./api";

// Trash: what has been deleted and can still be brought back. Each call throws when it fails, with the
// server's own words where it gave any, so the screen that asked can say so.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const trashService = {
    // { days, items }: how long things are kept, and everything in Trash, the most recently deleted first
    getTrash: () => call(() => api.get("/trash"), "Failed to fetch Trash."),

    // kind: "routine", "habit", "transaction", "subscription", "todo", "todoList" or "goal"
    restore: (kind, id) => call(() => api.post(`/trash/${kind}/${id}/restore`), "It couldn’t be recovered."),

    // For good: nothing brings it back after this
    erase: (kind, id) => call(() => api.delete(`/trash/${kind}/${id}`), "It couldn’t be erased."),
    empty: () => call(() => api.delete("/trash"), "Trash couldn’t be emptied."),
};

export default trashService;
