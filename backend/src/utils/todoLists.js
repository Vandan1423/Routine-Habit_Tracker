import TodoList from "../models/TodoList.js";

const GENERAL_LIST_NAME = "To-do";

/**
 * The account's general list, made the first time it is asked for.
 * Two requests making it at once collide on its unique index; the loser reads the winner's.
 */
export const generalListOf = async (userId) => {
    const existing = await TodoList.findOne({ user: userId, isDefault: true });
    if (existing) return existing;

    try {
        return await TodoList.create({ user: userId, name: GENERAL_LIST_NAME, isDefault: true });
    } catch (error) {
        if (error.code !== 11000) throw error;
        return TodoList.findOne({ user: userId, isDefault: true });
    }
};
