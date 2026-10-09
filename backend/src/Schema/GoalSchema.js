import Joi from "joi";
import { dateString, NOTHING_TO_UPDATE, objectId } from "./CommonSchema.js";

// Only the fields listed here can be set by a client. Ownership and the dates are decided by the server.

// The most milestones a goal may have, and the most routines and habits it may be carried by
export const MOST_MILESTONES = 30;
export const MOST_LINKS = 20;

const milestoneTitle = Joi.string().trim().min(1).max(120);

// A milestone already on the goal is named by its id and keeps its place in time; one without an id is new
const milestone = Joi.object({
    id: objectId,
    title: milestoneTitle.required(),
    done: Joi.boolean(),
});

const link = Joi.object({
    kind: Joi.string().valid("routine", "habit").required(),
    id: objectId.required(),
});

const goalFields = {
    title: Joi.string().trim().min(1).max(120),
    note: Joi.string().trim().max(500).allow(""),
    targetDate: dateString.allow(null),
    milestones: Joi.array().items(milestone).max(MOST_MILESTONES),
    links: Joi.array()
        .items(link)
        .max(MOST_LINKS)
        .unique((a, b) => a.kind === b.kind && a.id === b.id),
};

export const createGoalSchema = Joi.object({
    ...goalFields,
    title: goalFields.title.required(),
});

export const updateGoalSchema = Joi.object({
    ...goalFields,
    // Whether its owner counts it as reached
    reached: Joi.boolean(),
})
    .min(1)
    .messages(NOTHING_TO_UPDATE);

export const milestoneParams = Joi.object({
    id: objectId.required(),
    milestoneId: objectId.required(),
});

export const setMilestoneSchema = Joi.object({
    done: Joi.boolean().required(),
});
