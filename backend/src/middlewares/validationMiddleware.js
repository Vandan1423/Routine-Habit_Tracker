import { loginSchema, registerSchema } from "../Schema/AuthSchema.js";
import ExpressError from "../utils/ExpressError.js";

//Validation for Auth Routes
module.exports.validateRegister = (req, res, next) => {
    const { error } = registerSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const messages = error.details.map((el) => el.message).join(", ");
        throw new ExpressError(400, messages);
    }
    next();
};

module.exports.validateLogin = (req, res, next) => {
    const { error } = loginSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        const messages = error.details.map((el) => el.message).join(", ");
        throw new ExpressError(400, messages);
    }
    next();
};
