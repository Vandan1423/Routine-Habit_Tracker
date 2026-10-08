import Joi from "joi";

export const dailyLogsQuerySchema = Joi.object({
    days: Joi.number().integer().min(1).max(366),
});
