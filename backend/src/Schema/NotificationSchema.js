import Joi from "joi";

// A browser's push subscription, as PushSubscription.toJSON() gives it. Anything else it carries is dropped.
export const subscribeSchema = Joi.object({
    subscription: Joi.object({
        endpoint: Joi.string()
            .uri({ scheme: ["https"] })
            .max(1000)
            .required(),
        keys: Joi.object({
            p256dh: Joi.string().max(200).required(),
            auth: Joi.string().max(100).required(),
        }).required(),
    }).required(),
});

export const unsubscribeSchema = Joi.object({
    endpoint: Joi.string().max(1000).required(),
});
