import Joi from "joi";

// Building blocks shared by the request schemas

export const objectId = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
        "string.base": "{{#label}} is not a valid id.",
        "string.pattern.base": "{{#label}} is not a valid id.",
    });

// For update schemas: at least one of the listed fields has to be present
export const NOTHING_TO_UPDATE = {
    "object.min": "No valid fields to update.",
};

// "YYYY-MM-DD", and it has to be a real calendar day
export const dateString = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((value, helpers) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        const isRealDay =
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value;

        return isRealDay ? value : helpers.error("string.pattern.base");
    })
    .messages({
        "string.pattern.base":
            "{{#label}} must be a valid date in YYYY-MM-DD format.",
    });

// "14:30" or "2:30 PM"
export const timeLabel = Joi.string()
    .pattern(/^([01]?\d|2[0-3]):[0-5]\d(\s*[AP]M)?$/i)
    .messages({
        "string.pattern.base": "{{#label}} must be a time such as 14:30.",
    });

// [0,1,2,3,4,5,6] where 0 = Sunday
export const weekdays = Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .unique()
    .max(7);

export const idParam = Joi.object({
    id: objectId.required(),
});
