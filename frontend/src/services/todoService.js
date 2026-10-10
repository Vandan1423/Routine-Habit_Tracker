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

    // listId left out puts it on the general list
    createTodo: async (title, listId, key) =>
        (await call(() => write("post", "/todos", listId ? { title, listId } : { title }, { key }), NOT_SAVED)).todo,
    // title, done and listId are what can be changed
    updateTodo: async (id, data) => (await call(() => write("put", `/todos/${id}`, data), NOT_SAVED)).todo,
    deleteTodo: (id) => call(() => write("delete", `/todos/${id}`), NOT_DELETED),
};

export default todoService;
