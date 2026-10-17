import Joi from "joi";
import { clockTime, dateString, NOTHING_TO_UPDATE, objectId } from "./CommonSchema.js";

// Only the fields listed here can be set by a client. Ownership and the dates are decided by the server.

const listName = Joi.string().trim().min(1).max(60);
const todoTitle = Joi.string().trim().min(1).max(200);

export const createListSchema = Joi.object({
    name: listName.required(),
});

export const updateListSchema = Joi.object({
    name: listName.required(),
});

// Planning one: the day it is for, and when on that day. null takes either away.
// That the day is not in the past, and that an end comes after its start, is checked by the server.
const planned = {
    date: dateString.allow(null),
    time: clockTime.allow(null),
    endTime: clockTime.allow(null),
};

export const createTodoSchema = Joi.object({
    title: todoTitle.required(),
    // Left out, it goes on the general list
    listId: objectId,
    ...planned,
});

export const updateTodoSchema = Joi.object({
    title: todoTitle,
    done: Joi.boolean(),
    // Moves it to another list
    listId: objectId,
    ...planned,
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);
