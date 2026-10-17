import AuthorizationCode from "../models/AuthorizationCode.js";
import Connection from "../models/Connection.js";
import User from "../models/User.js";
import ExpressError from "../utils/ExpressError.js";
import {
    ACCESS_TOKEN_TTL_MS,
    CLAUDE_CALLBACK,
    CODE_TTL_MS,
    CONNECTION_TTL_MS,
    REFRESH_GRACE_MS,
    SCOPE,
    canonicalUrl,
    clientFor,
    hashToken,
    matchesChallenge,
    mcpResource,
    newClientId,
    newToken,
    publicOrigin,
} from "../utils/connector.js";

// How a person lets Claude into their account: OAuth 2.1 with PKCE, as the MCP specification and Claude ask.
//
//   1. Claude reads where to sign in (the two discovery documents).
//   2. It sends the person to /api/oauth/authorize, which checks the request and passes it to the site's
//      "Connect Claude" page (/connect). There the person signs in if they aren't, and allows or refuses.
//   3. The page sends the answer to POST /api/oauth/authorize, which hands back where to send the person:
//      to Claude, with a one-time code (or the refusal).
//   4. Claude trades the code for an access token and a refresh token at /api/oauth/token, and uses the access
//      token at /api/mcp (see connectorMiddleware.js) until it refreshes it.
//
// Errors in the steps Claude talks to directly are answered in OAuth's own shape ({ error, error_description }),
// not the app's ({ success, message }), because that is what Claude reads.

const text = (value) => (typeof value === "string" ? value : "");

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

const refuse = (res, status, error, description) =>
    res.status(status).set(NO_STORE).json({ error, error_description: description });

// ── 1. Discovery ──

// RFC 9728: what the MCP endpoint is, and who grants tokens for it
export const protectedResourceMetadata = (req, res) => {
    res.json({
        resource: mcpResource(req),
        authorization_servers: [publicOrigin(req)],
        scopes_supported: [SCOPE],
        bearer_methods_supported: ["header"],
        resource_name: "Nityakram",
    });
};

// RFC 8414: where to sign in and collect tokens. Claude names itself with its Client ID Metadata Document when
// client_id_metadata_document_supported is true and "none" is a token endpoint auth method; otherwise it registers.
export const authorizationServerMetadata = (req, res) => {
    const origin = publicOrigin(req);

    res.json({
        issuer: origin,
        authorization_endpoint: `${origin}/api/oauth/authorize`,
        token_endpoint: `${origin}/api/oauth/token`,
        registration_endpoint: `${origin}/api/oauth/register`,
        revocation_endpoint: `${origin}/api/oauth/revoke`,
        scopes_supported: [SCOPE, "offline_access"],
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        revocation_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        client_id_metadata_document_supported: true,
        authorization_response_iss_parameter_supported: true,
    });
};

// ── 2 and 3. Asking the person ──

// Where the person goes back to Claude: its address with the answer, and who answered (iss, RFC 9207)
const backTo = (req, redirectUri, answer) => {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(answer)) {
        if (value) url.searchParams.set(key, value);
    }
    url.searchParams.set("iss", publicOrigin(req));
    return url.toString();
};

/**
 * Checks an authorization request in the order OAuth asks. Who is asking and where to send the person back come
 * first: a problem there can't be sent back to an address that isn't trusted, so it is shown on the site instead.
 * A problem with the rest is sent back to Claude.
 * @returns {Object} - { refused: "client" | "redirect" }, { redirectTo } for an error to send back, or { request }
 */
const readAuthorization = (req, params) => {
    const client = clientFor(text(params.client_id));
    if (!client) return { refused: "client" };

    const redirectUri =
        text(params.redirect_uri) || (client.redirectUris.length === 1 ? client.redirectUris[0] : "");
    if (!client.redirectUris.includes(redirectUri)) return { refused: "redirect" };

    const state = text(params.state);
    const sendBack = (error, description) => ({
        redirectTo: backTo(req, redirectUri, { error, error_description: description, state }),
    });

    if (text(params.response_type) !== "code") {
        return sendBack("unsupported_response_type", "Only response_type=code is supported.");
    }

    const codeChallenge = text(params.code_challenge);
    if (text(params.code_challenge_method) !== "S256" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)) {
        return sendBack("invalid_request", "PKCE with code_challenge_method=S256 is required.");
    }

    // RFC 8707: a token is only ever granted for this server's MCP endpoint
    const resource = mcpResource(req);
    if (params.resource && canonicalUrl(text(params.resource)) !== canonicalUrl(resource)) {
        return sendBack("invalid_target", "This server only grants access to its own MCP endpoint.");
    }

    return { request: { client, redirectUri, state, codeChallenge, resource } };
};

// @route   GET /api/oauth/authorize
// Where Claude sends the person. The request goes on to the site's page, which asks them.
export const authorize = (req, res) => {
    const found = readAuthorization(req, req.query);
    const site = publicOrigin(req);

    if (found.refused) return res.redirect(`${site}/connect?problem=${found.refused}`);
    if (found.redirectTo) return res.redirect(found.redirectTo);

    const { request } = found;
    const query = new URLSearchParams(
        Object.entries({
            response_type: "code",
            client_id: request.client.id,
            redirect_uri: request.redirectUri,
            code_challenge: request.codeChallenge,
            code_challenge_method: "S256",
            state: request.state,
            scope: text(req.query.scope),
            resource: text(req.query.resource),
        }).filter(([, value]) => value),
    );
    res.redirect(`${site}/connect?${query}`);
};

// @route   POST /api/oauth/authorize (signed in)
// The person's answer. Says where to send them: back to Claude with a code, or with the refusal.
export const decide = async (req, res, next) => {
    try {
        const found = readAuthorization(req, req.body);

        if (found.refused === "client") throw new ExpressError(400, "Only Claude can connect to Nityakram.");
        if (found.refused) throw new ExpressError(400, "That isn’t an address of Claude’s to go back to.");
        if (found.redirectTo) return res.json({ redirectTo: found.redirectTo });

        const { request } = found;

        if (!req.body.approve) {
            return res.json({
                redirectTo: backTo(req, request.redirectUri, {
                    error: "access_denied",
                    error_description: "Access was not allowed.",
                    state: request.state,
                }),
            });
        }

        const code = newToken("nkc");
        await AuthorizationCode.create({
            _id: hashToken(code),
            user: req.user._id,
            clientId: request.client.id,
            redirectUri: request.redirectUri,
            codeChallenge: request.codeChallenge,
            scope: SCOPE,
            resource: request.resource,
            expiresAt: new Date(Date.now() + CODE_TTL_MS),
        });

        res.json({ redirectTo: backTo(req, request.redirectUri, { code, state: request.state }) });
    } catch (error) {
        next(error);
    }
};

// ── 4. Tokens ──

// The client a token request names: in the body, or as the user name of Basic authentication from a client that
// authenticates anyway (Claude is a public client and sends no secret; any secret sent is not needed)
const clientIdOf = (req) => {
    const named = text(req.body?.client_id);
    if (named) return named;

    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Basic ")) return "";
    try {
        const [user] = Buffer.from(header.slice(6), "base64").toString("utf8").split(":");
        return decodeURIComponent(user ?? "");
    } catch {
        return "";
    }
};

// A new pair of tokens: what Claude is given, and what is kept of them (their hashes and when they run out)
const freshTokens = (now) => {
    const accessToken = newToken("nka");
    const refreshToken = newToken("nkr");

    return {
        answer: {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: ACCESS_TOKEN_TTL_MS / 1000,
            refresh_token: refreshToken,
            scope: SCOPE,
        },
        kept: {
            accessToken: hashToken(accessToken),
            accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
            refreshToken: hashToken(refreshToken),
            expiresAt: new Date(now.getTime() + CONNECTION_TTL_MS),
        },
    };
};

const resourceMismatch = (given, granted) => given && canonicalUrl(text(given)) !== canonicalUrl(granted);

// The code from "Allow", traded once for the connection's first tokens
const tradeCode = async (req, res) => {
    const body = req.body ?? {};
    const clientId = clientIdOf(req);
    if (!clientFor(clientId)) return refuse(res, 401, "invalid_client", "Only Claude can connect to Nityakram.");

    // Deleted as it is read, so a code works once even if it is sent twice at the same moment
    const code = text(body.code);
    const saved = code ? await AuthorizationCode.findOneAndDelete({ _id: hashToken(code) }) : null;
    const now = new Date();

    if (!saved || saved.expiresAt <= now || saved.clientId !== clientId) {
        return refuse(res, 400, "invalid_grant", "The authorization code is not valid, or has expired.");
    }
    if (text(body.redirect_uri) && text(body.redirect_uri) !== saved.redirectUri) {
        return refuse(res, 400, "invalid_grant", "redirect_uri does not match the authorization request.");
    }
    if (!matchesChallenge(text(body.code_verifier), saved.codeChallenge)) {
        return refuse(res, 400, "invalid_grant", "code_verifier does not match the code challenge.");
    }
    if (resourceMismatch(body.resource, saved.resource)) {
        return refuse(res, 400, "invalid_target", "This server only grants access to its own MCP endpoint.");
    }
    if (!(await User.exists({ _id: saved.user }))) {
        return refuse(res, 400, "invalid_grant", "The account no longer exists.");
    }

    const tokens = freshTokens(now);
    await Connection.create({
        user: saved.user,
        clientId,
        clientName: "Claude",
        scope: saved.scope,
        resource: saved.resource,
        ...tokens.kept,
    });

    res.set(NO_STORE).json(tokens.answer);
};

// A refresh: new tokens for the same connection. The refresh token changes every time (OAuth 2.1 asks this of
// public clients); the one it replaces keeps working for a moment, in case the answer never reached Claude.
const refresh = async (req, res) => {
    const body = req.body ?? {};
    const presented = text(body.refresh_token);
    const hashed = presented ? hashToken(presented) : null;
    const now = new Date();

    const connection = hashed
        ? ((await Connection.findOne({ refreshToken: hashed })) ??
          (await Connection.findOne({
              previousRefreshToken: hashed,
              rotatedAt: { $gt: new Date(now.getTime() - REFRESH_GRACE_MS) },
          })))
        : null;
    const clientId = clientIdOf(req);

    if (!connection || connection.expiresAt <= now || (clientId && clientId !== connection.clientId)) {
        return refuse(res, 400, "invalid_grant", "The refresh token is not valid, or has expired.");
    }
    if (resourceMismatch(body.resource, connection.resource)) {
        return refuse(res, 400, "invalid_target", "This server only grants access to its own MCP endpoint.");
    }

    // Only one refresh of the same token can win; the other is told to start again
    const tokens = freshTokens(now);
    const rotated = await Connection.findOneAndUpdate(
        { _id: connection._id, refreshToken: connection.refreshToken },
        { $set: { ...tokens.kept, previousRefreshToken: hashed, rotatedAt: now } },
    );
    if (!rotated) {
        return refuse(res, 400, "invalid_grant", "The refresh token has just been used.");
    }

    res.set(NO_STORE).json(tokens.answer);
};

// @route   POST /api/oauth/token (form-encoded, as RFC 6749 sends it; JSON is taken too)
export const token = async (req, res) => {
    try {
        const grant = text(req.body?.grant_type);
        if (grant === "authorization_code") return await tradeCode(req, res);
        if (grant === "refresh_token") return await refresh(req, res);
        return refuse(res, 400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
    } catch (error) {
        console.error("Token endpoint error:", error);
        return refuse(res, 500, "server_error", "Something went wrong. Please try again.");
    }
};

// @route   POST /api/oauth/register
// Dynamic Client Registration (RFC 7591), for a Claude that registers instead of naming itself by its document.
// Open to Claude's callback only, and nothing is stored: see clientFor.
export const register = (req, res) => {
    const uris = req.body?.redirect_uris;

    if (!Array.isArray(uris) || uris.length === 0 || !uris.every((uri) => uri === CLAUDE_CALLBACK)) {
        return refuse(res, 400, "invalid_redirect_uri", "Only Claude can connect to Nityakram.");
    }

    res.status(201)
        .set(NO_STORE)
        .json({
            client_id: newClientId(),
            client_id_issued_at: Math.floor(Date.now() / 1000),
            client_name: "Claude",
            redirect_uris: [CLAUDE_CALLBACK],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
            scope: SCOPE,
        });
};

// @route   POST /api/oauth/revoke
// RFC 7009: Claude giving up a token, as when the person removes the connector. The whole connection ends.
// The answer is the same whether or not the token was known.
export const revoke = async (req, res) => {
    try {
        const presented = text(req.body?.token);
        if (presented) {
            const hashed = hashToken(presented);
            await Connection.deleteOne({ $or: [{ accessToken: hashed }, { refreshToken: hashed }] });
        }
        res.status(200).set(NO_STORE).json({});
    } catch (error) {
        console.error("Revocation error:", error);
        refuse(res, 503, "temporarily_unavailable", "Try again in a moment.");
    }
};

// ── Settings ──

// @route   GET /api/connections
// The apps let into the account, and the address to add in Claude
export const getConnections = async (req, res, next) => {
    try {
        const connections = await Connection.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .select("clientName createdAt lastUsedAt");

        res.status(200).json({ url: mcpResource(req), connections });
    } catch (error) {
        next(error);
    }
};

// @route   DELETE /api/connections/:id
// Ends one connection at once: its tokens stop working with the next request
export const removeConnection = async (req, res, next) => {
    try {
        const { deletedCount } = await Connection.deleteOne({ _id: req.params.id, user: req.user._id });
        if (!deletedCount) return res.status(404).json({ message: "That connection wasn’t found." });

        res.status(200).json({ message: "Disconnected." });
    } catch (error) {
        next(error);
    }
};
