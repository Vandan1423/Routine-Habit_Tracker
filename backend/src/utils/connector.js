import crypto from "node:crypto";

// The Claude connector: Claude reaches a person's account through the MCP endpoint (/api/mcp), with a token
// the person grants it by signing in here (OAuth 2.1, see oauthController.js). This file holds what both
// sides share: where the server is, who may connect, and how tokens are made and checked.

// The one scope there is: the planner, as its owner can use it. Account and security actions are not in it.
export const SCOPE = "nityakram";

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const CONNECTION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days without a refresh, and the connection lapses
export const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes from "Allow" to Claude collecting its token
// A refresh token that has just been replaced still works this long, for a refresh whose answer never arrived
export const REFRESH_GRACE_MS = 2 * 60 * 1000;

/**
 * Where this server is reached from outside, without a trailing slash. The site and the API share one origin
 * (on Vercel; locally Vite passes /api and /.well-known on), so it is the site's address in CLIENT_URL.
 * The MCP URL a person adds in Claude is this plus /api/mcp, and every token is bound to it.
 */
export const publicOrigin = (req) => {
    const configured = process.env.CLIENT_URL?.trim().replace(/\/+$/, "");
    return configured || `${req.protocol}://${req.get("host")}`;
};

export const mcpResource = (req) => `${publicOrigin(req)}/api/mcp`;

export const resourceMetadataUrl = (req) =>
    `${publicOrigin(req)}/.well-known/oauth-protected-resource/api/mcp`;

// The same address however it was written: lower-case scheme and host, no default port, no trailing slash,
// no query or fragment (URL itself does the first three)
export const canonicalUrl = (value) => {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
    } catch {
        return null;
    }
};

// ── Who may connect: Claude's own apps, and nothing else ──

// Where Claude's apps (claude.ai, the desktop and phone apps) take the person back to after "Allow"
export const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

// How Claude's apps name themselves: the address of a Client ID Metadata Document Anthropic publishes.
// Its redirect is the callback above, and nothing else; it is written here rather than fetched, so signing in
// never waits on another server. Claude Code (a different document, with loopback redirects) is not let in.
export const CLAUDE_CLIENT_ID = "https://claude.ai/oauth/mcp-oauth-client-metadata";

// Claude can also register itself instead (Dynamic Client Registration). Registering is open only to the callback
// above, so the id it gets back needs keeping nowhere: whatever the id, codes can only ever go to claude.ai.
const REGISTERED_CLIENT = /^claude-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const newClientId = () => `claude-${crypto.randomUUID()}`;

/**
 * The client a client_id names, if it is one that may connect.
 * @returns {Object|null} - { id, name, redirectUris }
 */
export const clientFor = (clientId) => {
    if (clientId !== CLAUDE_CLIENT_ID && !REGISTERED_CLIENT.test(clientId ?? "")) return null;
    return { id: clientId, name: "Claude", redirectUris: [CLAUDE_CALLBACK] };
};

// ── Tokens ──
// Random, and kept only as their SHA-256, like the app's own sessions: a copy of the database opens nothing.
// The prefix says what a leaked one is at a glance.

export const newToken = (prefix) => `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// PKCE (S256): the verifier Claude kept, hashed, is the challenge it sent with the request
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
export const matchesChallenge = (verifier, challenge) =>
    VERIFIER.test(verifier ?? "") &&
    crypto.createHash("sha256").update(verifier).digest("base64url") === challenge;
