import Joi from "joi";
import { NOTHING_TO_UPDATE, objectId } from "./CommonSchema.js";

// Only the fields listed here can be set by a client. Ownership and the dates are decided by the server.

const listName = Joi.string().trim().min(1).max(60);
const todoTitle = Joi.string().trim().min(1).max(200);

export const createListSchema = Joi.object({
    name: listName.required(),
});

export const updateListSchema = Joi.object({
    name: listName.required(),
});

export const createTodoSchema = Joi.object({
    title: todoTitle.required(),
    // Left out, it goes on the general list
    listId: objectId,
});

export const updateTodoSchema = Joi.object({
    title: todoTitle,
    done: Joi.boolean(),
    // Moves it to another list
    listId: objectId,
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);
