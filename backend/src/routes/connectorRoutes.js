import express from "express";

import {
    authorizationServerMetadata,
    authorize,
    decide,
    getConnections,
    protectedResourceMetadata,
    register,
    removeConnection,
    revoke,
    token,
} from "../controllers/connectorController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { checkOrigin, requireConnection } from "../middlewares/connectorMiddleware.js";
import { connectorRateLimit } from "../middlewares/rateLimitMiddleware.js";
import { validate } from "../middlewares/validationMiddleware.js";
import { serveMcp } from "../mcp/server.js";
import { authorizationDecisionSchema, connectionParam } from "../Schema/OAuthSchema.js";

// --- THE CLAUDE CONNECTOR ---
// See controllers/connectorController.js for how the pieces fit together.

// Base URL: /.well-known (at the site's root: vercel.json sends it here, and so does Vite locally)
// Neither document needs the database.
export const wellKnownRoutes = express.Router();
wellKnownRoutes.get("/oauth-protected-resource", protectedResourceMetadata);
// The form clients try first for an MCP URL with a path (RFC 9728 section 3.1)
wellKnownRoutes.get("/oauth-protected-resource/api/mcp", protectedResourceMetadata);
wellKnownRoutes.get("/oauth-authorization-server", authorizationServerMetadata);

// Base URL: /api/oauth
export const oauthRoutes = express.Router();
oauthRoutes
    .route("/authorize")
    .get(authorize)
    .post(protect, validate({ body: authorizationDecisionSchema }), decide);
oauthRoutes.post("/token", token);
oauthRoutes.post("/register", register);
oauthRoutes.post("/revoke", revoke);

// Base URL: /api/connections (Settings)
export const connectionRoutes = express.Router();
connectionRoutes.use(protect);
connectionRoutes.get("/", getConnections);
connectionRoutes.delete("/:id", validate({ params: connectionParam }), removeConnection);

// Base URL: /api/mcp
// POST carries every MCP message. GET and DELETE are answered 405: nothing is kept between requests.
export const mcpRoutes = express.Router();
mcpRoutes.all("/", checkOrigin, requireConnection, connectorRateLimit, (req, res) =>
    serveMcp(req, res, req.body),
);
