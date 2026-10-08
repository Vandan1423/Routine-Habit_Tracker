import Joi from "joi";
import Routine from "../models/Routine.js";
import {
    dateString,
    NOTHING_TO_UPDATE,
    objectId,
    timeLabel,
    weekdays,
} from "./CommonSchema.js";

// Only the fields listed here can be set by a client.
// The XP reward and ownership are decided by the server.
const routineFields = {
    title: Joi.string().trim().min(1).max(120),
    description: Joi.string().trim().max(500).allow(""),
    startTime: timeLabel,
    endTime: timeLabel.allow(""),
    category: Joi.string().valid(...Routine.schema.path("category").enumValues),
    isRecurring: Joi.boolean(),
    recurringDays: weekdays,
    order: Joi.number().integer().min(0),
    date: dateString.allow(null),
};

export const createRoutineSchema = Joi.object({
    ...routineFields,
    title: routineFields.title.required(),
    startTime: routineFields.startTime.required(),
});

export const updateRoutineSchema = Joi.object(routineFields)
    .min(1)
    .messages(NOTHING_TO_UPDATE);

export const reorderRoutinesSchema = Joi.object({
    routines: Joi.array()
        .items(
            Joi.object({
                id: objectId.required(),
                order: Joi.number().integer().min(0).required(),
            }),
        )
        .max(500)
        .required(),
});

// The completion time is not accepted from the client: the server records it
export const completeRoutineSchema = Joi.object({
    date: dateString,
});

export const uncompleteRoutineSchema = Joi.object({
    date: dateString,
});

export const routinesQuerySchema = Joi.object({
    date: dateString,
});
