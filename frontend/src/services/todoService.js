import api from "./api";

// To-do lists. Each call throws when it fails, with the server's own words where it gave any.
// Bringing a deleted list or to-do back is trashService's work.
const call = async (request, fallback) => {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || fallback, { cause: error });
    }
};

const NOT_SAVED = "It couldn’t be saved.";
const NOT_DELETED = "It couldn’t be deleted.";

const todoService = {
    // Every list with its to-dos: the general list first
    getLists: async () => (await call(() => api.get("/todos"), "Failed to fetch the to-do lists.")).lists ?? [],

    createList: async (name) => (await call(() => api.post("/todos/lists", { name }), NOT_SAVED)).list,
    renameList: async (id, name) => (await call(() => api.put(`/todos/lists/${id}`, { name }), NOT_SAVED)).list,
    deleteList: (id) => call(() => api.delete(`/todos/lists/${id}`), NOT_DELETED),
    // Moves a list's finished to-dos to Trash; answers with their ids
    clearDone: (id) => call(() => api.post(`/todos/lists/${id}/clear`), NOT_DELETED),

    // listId left out puts it on the general list
    createTodo: async (title, listId) =>
        (await call(() => api.post("/todos", listId ? { title, listId } : { title }), NOT_SAVED)).todo,
    // title, done and listId are what can be changed
    updateTodo: async (id, data) => (await call(() => api.put(`/todos/${id}`, data), NOT_SAVED)).todo,
    deleteTodo: (id) => call(() => api.delete(`/todos/${id}`), NOT_DELETED),
};

export default todoService;
