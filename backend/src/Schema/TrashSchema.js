import Joi from "joi";
import { objectId } from "./CommonSchema.js";
import { TRASH_KINDS } from "../utils/trashKinds.js";

// /api/trash/:kind/:id
export const trashedParam = Joi.object({
    kind: Joi.string()
        .valid(...Object.keys(TRASH_KINDS))
        .required()
        .messages({ "any.only": "That is not something Trash holds." }),
    id: objectId.required(),
});
