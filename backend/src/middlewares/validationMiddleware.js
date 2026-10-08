import { loginSchema, registerSchema } from "../Schema/AuthSchema.js";
import ExpressError from "../utils/ExpressError.js";

const check = (schema, value) => {
    const { error, value: validated } = schema.validate(value ?? {}, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const messages = error.details.map((el) => el.message).join(", ");
        throw new ExpressError(400, messages);
    }
    return validated;
};

// Validates the given parts of a request against their schemas.
// req.body is replaced by the validated copy, so fields a schema doesn't list never reach a controller.
export const validate =
    ({ params, query, body }) =>
    (req, res, next) => {
        if (params) check(params, req.params);
        if (query) check(query, req.query);
        if (body) req.body = check(body, req.body);
        next();
    };

// Validation for Auth Routes
export const validateRegister = validate({ body: registerSchema });

export const validateLogin = validate({ body: loginSchema });
