import api from "./api";
import { write } from "./outbox";

// To-do lists. Each call throws when it fails, with the server's own words where it gave any.
// Bringing a deleted list or to-do back is trashService's work.
// Every change here is on screen before it is sent, so it goes through the outbox; `key` is the new
// thing's own (newKey), so that sending it twice still makes one.
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

    createList: async (name, key) => (await call(() => write("post", "/todos/lists", { name }, { key }), NOT_SAVED)).list,
    renameList: async (id, name) => (await call(() => write("put", `/todos/lists/${id}`, { name }), NOT_SAVED)).list,
    deleteList: (id) => call(() => write("delete", `/todos/lists/${id}`), NOT_DELETED),
    // Moves a list's finished to-dos to Trash; answers with their ids
    clearDone: (id) => call(() => write("post", `/todos/lists/${id}/clear`), NOT_DELETED),

    // The to-dos planned for a stretch of days ("YYYY-MM-DD", both included), finished or not: for a week
    // further back than the lists carry
    getPlanned: async (from, to) =>
        (await call(() => api.get("/todos/planned", { params: { from, to } }), "Failed to fetch the planned to-dos.")).todos ?? [],

    // listId left out puts it on the general list. planned: { date, time, endTime }, any of them, for one
    // planned for a day
    createTodo: async (title, listId, key, planned = {}) =>
        (await call(() => write("post", "/todos", { title, ...(listId ? { listId } : {}), ...planned }, { key }), NOT_SAVED)).todo,
    // title, done, listId, date, time and endTime are what can be changed
    updateTodo: async (id, data) => (await call(() => write("put", `/todos/${id}`, data), NOT_SAVED)).todo,
    deleteTodo: (id) => call(() => write("delete", `/todos/${id}`), NOT_DELETED),
};

export default todoService;
