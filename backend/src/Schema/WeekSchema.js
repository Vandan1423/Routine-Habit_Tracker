import Joi from "joi";
import { dateString, NOTHING_TO_UPDATE, objectId } from "./CommonSchema.js";

// Only the fields listed here can be set by a client. The owner is decided by the server.

// The most things a week can be set to focus on: a short list, as week planners keep it
export const MOST_FOCUS = 5;

const longText = Joi.string().allow("").max(4000);

export const weekParam = Joi.object({
    start: dateString.required(),
});

// Each field sent replaces what is kept, so sending the same thing twice changes nothing
export const updateWeekSchema = Joi.object({
    focus: Joi.array()
        .items(
            Joi.object({
                // Kept from before, so the same line keeps its place
                _id: objectId,
                title: Joi.string().trim().min(1).max(120).required(),
                done: Joi.boolean().default(false),
                goalId: objectId.allow(null),
            }),
        )
        .max(MOST_FOCUS)
        .messages({ "array.max": `A week can focus on at most ${MOST_FOCUS} things.` }),
    notes: longText,
    wentWell: longText,
    better: longText,
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);
