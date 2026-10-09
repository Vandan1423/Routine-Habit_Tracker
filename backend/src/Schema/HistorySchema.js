import Joi from "joi";
import { dateString } from "./CommonSchema.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// The longest stretch of days one request may ask for: a year, leap day included
export const MOST_DAYS = 366;

const daysBetween = (from, to) =>
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;

// ?from=2026-09-01&to=2026-09-30, both days included
export const dayRangeQuerySchema = Joi.object({
    from: dateString.required(),
    to: dateString.required(),
})
    .custom((value, helpers) => {
        const span = daysBetween(value.from, value.to);

        if (span < 0) return helpers.error("range.order");
        if (span >= MOST_DAYS) return helpers.error("range.length");
        return value;
    })
    .messages({
        "range.order": "\"to\" must not be before \"from\".",
        "range.length": `At most ${MOST_DAYS} days can be asked for at once.`,
    });

export const dayParam = Joi.object({
    date: dateString.required(),
});

// The place a page of the ledger starts after: the moment and id of the last entry already held
export const ledgerCursor = Joi.string()
    .pattern(/^\d{1,16}_[0-9a-fA-F]{24}$/)
    .messages({ "string.pattern.base": "{{#label}} is not a valid place in the ledger." });

export const ledgerQuerySchema = Joi.object({
    before: ledgerCursor,
    limit: Joi.number().integer().min(1).max(100),
});
