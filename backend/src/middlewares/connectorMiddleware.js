import Connection from "../models/Connection.js";
import User, { PRIVATE_USER_FIELDS } from "../models/User.js";
import { callApp } from "../mcp/callApp.js";
import {
    SCOPE,
    hashToken,
    mcpResource,
    publicOrigin,
    resourceMetadataUrl,
} from "../utils/connector.js";

// lastUsedAt is written at most this often, so a busy conversation isn't a write per tool call
const LAST_USED_STEP_MS = 5 * 60 * 1000;

// Browsers that may call the MCP endpoint. Claude itself calls from its servers and sends no Origin at all.
const allowedOrigins = (req) => new Set([publicOrigin(req), "https://claude.ai", "https://claude.com"]);

/**
 * Refuses a request sent by a web page on another site (the MCP specification asks servers to check Origin,
 * against DNS rebinding). Requests without an Origin, which is every request from Claude, pass.
 */
export const checkOrigin = (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins(req).has(origin)) {
        return res.status(403).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "This origin may not call the MCP endpoint." },
            id: null,
        });
    }
    next();
};

/**
 * Lets an MCP request through only with an access token from a live connection, granted for this endpoint.
 * Anything else gets the 401 that tells Claude where to sign in (RFC 9728): Claude reads the metadata it points
 * to, sends the person through sign-in, and tries again with a token.
 * Sets req.user, and req.auth for the MCP handler: the tools reach the app through req.auth.extra.callApp.
 */
export const requireConnection = async (req, res, next) => {
    try {
        const header = req.headers.authorization ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

        const now = new Date();
        const connection = token ? await Connection.findOne({ accessToken: hashToken(token) }) : null;
        const usable =
            connection && connection.accessExpiresAt > now && connection.resource === mcpResource(req);
        const user = usable ? await User.findById(connection.user).select(PRIVATE_USER_FIELDS) : null;

        if (!user) {
            const problem = token ? "The access token is not valid, or has expired." : "Sign in to Nityakram to use it from Claude.";
            const challenge = [
                `Bearer resource_metadata="${resourceMetadataUrl(req)}"`,
                `scope="${SCOPE}"`,
                ...(token ? ['error="invalid_token"', `error_description="${problem}"`] : []),
            ].join(", ");

            return res
                .status(401)
                .set("WWW-Authenticate", challenge)
                .json({ error: token ? "invalid_token" : "unauthorized", error_description: problem });
        }

        if (!connection.lastUsedAt || now - connection.lastUsedAt > LAST_USED_STEP_MS) {
            await Connection.updateOne({ _id: connection._id }, { $set: { lastUsedAt: now } });
        }

        // The tools act through the app's own routes with a short-lived token of the app's own for this person
        const appToken = user.generateAccessToken();
        const app = req.app;

        req.user = user;
        req.auth = {
            token,
            clientId: connection.clientId,
            scopes: [connection.scope],
            expiresAt: Math.floor(connection.accessExpiresAt.getTime() / 1000),
            resource: new URL(connection.resource),
            extra: { callApp: (request) => callApp(app, appToken, request) },
        };
        next();
    } catch (error) {
        next(error);
    }
};
