import Joi from "joi";
import { objectId } from "./CommonSchema.js";

// The person's answer on the "Connect Claude" page: the authorization request it was shown, sent back as it came
// (oauthController.js checks it all again), and whether they allowed it.
const param = Joi.string().max(2048).allow("");

export const authorizationDecisionSchema = Joi.object({
    response_type: param,
    client_id: param,
    redirect_uri: param,
    code_challenge: param,
    code_challenge_method: param,
    state: param,
    scope: param,
    resource: param,
    approve: Joi.boolean().required(),
});

export const connectionParam = Joi.object({
    id: objectId.required(),
});
