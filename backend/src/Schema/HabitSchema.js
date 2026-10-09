import Joi from "joi";
import Habit from "../models/Habit.js";
import {
    dateString,
    NOTHING_TO_UPDATE,
    objectId,
    weekdays,
} from "./CommonSchema.js";

const enumOf = (path) => Habit.schema.path(path).enumValues;

// Only the fields listed here can be set by a client.
// Rewards, streak counters and ownership are decided by the server.
const habitFields = {
    title: Joi.string().trim().min(1).max(120),
    description: Joi.string().trim().max(500).allow(""),
    category: Joi.string().valid(...enumOf("category")),
    frequency: Joi.string().valid(...enumOf("frequency")),
    targetDays: weekdays,
    timeOfDay: Joi.string().valid(...enumOf("timeOfDay")),
    order: Joi.number().integer().min(0),
    habitType: Joi.string().valid(...enumOf("habitType")),
    targetQuantity: Joi.number().positive().max(1000000),
    unit: Joi.string().trim().max(30).allow(""),
    difficulty: Joi.string().valid(...enumOf("difficulty")),
};

export const createHabitSchema = Joi.object({
    ...habitFields,
    title: habitFields.title.required(),
});

export const updateHabitSchema = Joi.object(habitFields)
    .min(1)
    .messages(NOTHING_TO_UPDATE);

export const reorderHabitsSchema = Joi.object({
    habits: Joi.array()
        .items(
            Joi.object({
                id: objectId.required(),
                order: Joi.number().integer().min(0).required(),
            }),
        )
        .max(500)
        .required(),
});

export const logHabitSchema = Joi.object({
    date: dateString,
    quantity: Joi.number().positive().max(1000000),
    note: Joi.string().trim().max(500).allow(""),
});

// Today's count is set outright, not added to, so the same request sent twice changes nothing.
// 0 clears the day.
export const setHabitLogSchema = Joi.object({
    quantity: Joi.number().min(0).max(1000000).required(),
});
