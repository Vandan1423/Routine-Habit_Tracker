import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { appAddress, createClient, skipWithoutDatabase, startApp, stopApp } from "../helpers/app.js";
import Connection from "../../src/models/Connection.js";
import AuthorizationCode from "../../src/models/AuthorizationCode.js";
import Routine from "../../src/models/Routine.js";
import User from "../../src/models/User.js";
import eraseAccount from "../../src/utils/eraseAccount.js";

// The Claude connector, end to end, as Claude drives it: discovery, the person allowing it in, the token trade
// and refreshes, then MCP requests that act in the account through the app's own routes.

const SITE = "http://localhost:5173"; // CLIENT_URL in test/helpers/env.js
const MCP_URL = `${SITE}/api/mcp`;
const CLAUDE = "https://claude.ai/oauth/mcp-oauth-client-metadata";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const PROTOCOL = "2025-11-25";

const raw = (path, init = {}) => fetch(`${appAddress()}${path}`, { redirect: "manual", ...init });

const pkce = () => {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
};

const authorizeQuery = (overrides = {}) =>
    new URLSearchParams(
        Object.entries({
            response_type: "code",
            client_id: CLAUDE,
            redirect_uri: CALLBACK,
            code_challenge_method: "S256",
            state: "state-123",
            scope: "nityakram offline_access",
            resource: MCP_URL,
            ...overrides,
        }).filter(([, value]) => value !== undefined),
    );

const formPost = (path, fields) =>
    raw(path, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields),
    });

const tradeCode = (code, verifier, overrides = {}) =>
    formPost("/api/oauth/token", {
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: CLAUDE,
        redirect_uri: CALLBACK,
        resource: MCP_URL,
        ...overrides,
    });

const refreshWith = (refreshToken, overrides = {}) =>
    formPost("/api/oauth/token", {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLAUDE,
        resource: MCP_URL,
        ...overrides,
    });

/**
 * The whole sign-in, as Claude and the person go through it: Claude sends the person to authorize, which passes
 * them to the site's page; the page sends their answer; Claude collects the code from where it lands.
 * @returns {Object} - redirect (where the person was sent back to), code, verifier
 */
const allow = async (person, { approve = true, clientId = CLAUDE } = {}) => {
    const { verifier, challenge } = pkce();
    const sent = await raw(`/api/oauth/authorize?${authorizeQuery({ client_id: clientId, code_challenge: challenge })}`);
    assert.equal(sent.status, 302);

    const page = new URL(sent.headers.get("location"));
    assert.equal(`${page.origin}${page.pathname}`, `${SITE}/connect`);

    const answer = await person.post("/oauth/authorize", { ...Object.fromEntries(page.searchParams), approve });
    assert.equal(answer.status, 200, answer.text);

    const redirect = new URL(answer.body.redirectTo);
    return { redirect, code: redirect.searchParams.get("code"), verifier };
};

// Signs in and allows Claude, then trades the code: the tokens Claude would hold
const connect = async (person, options) => {
    const { code, verifier } = await allow(person, options);
    const response = await tradeCode(code, verifier, options?.clientId ? { client_id: options.clientId } : {});
    assert.equal(response.status, 200);
    return response.json();
};

let messageId = 0;

const mcp = async (accessToken, method, params = {}) => {
    messageId += 1;
    const response = await raw("/api/mcp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": PROTOCOL,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: messageId, method, params }),
    });
    // A single message comes back as JSON, or (for the 2025 protocol) as one SSE event carrying the same JSON
    const text = await response.text();
    const json = response.headers.get("content-type")?.startsWith("text/event-stream")
        ? text
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .at(-1)
        : text;
    let body = null;
    try {
        body = JSON.parse(json);
    } catch {
        body = text;
    }
    return { status: response.status, headers: response.headers, body };
};

const initialize = (accessToken) =>
    mcp(accessToken, "initialize", {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: "connector-test", version: "1.0.0" },
    });

// Calls a tool and reads its answer: { isError, data } where data is the parsed JSON (or the error text)
const callTool = async (accessToken, name, args = {}) => {
    const response = await mcp(accessToken, "tools/call", { name, arguments: args });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const result = response.body.result;
    const text = result.content?.[0]?.text ?? "";
    let data = text;
    try {
        data = JSON.parse(text);
    } catch {
        // an error message, as text
    }
    return { isError: Boolean(result.isError), data };
};

const signedIn = async () => {
    const person = createClient();
    await person.register();
    return person;
};

describe("the Claude connector", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    describe("discovery", () => {
        it("names the MCP endpoint and who grants tokens for it", async () => {
            const response = await raw("/.well-known/oauth-protected-resource/api/mcp");
            assert.equal(response.status, 200);
            const metadata = await response.json();

            assert.equal(metadata.resource, MCP_URL);
            assert.deepEqual(metadata.authorization_servers, [SITE]);
            assert.deepEqual(metadata.scopes_supported, ["nityakram"]);
        });

        it("says Claude may name itself by its document and must use PKCE", async () => {
            const metadata = await (await raw("/.well-known/oauth-authorization-server")).json();

            assert.equal(metadata.issuer, SITE);
            assert.equal(metadata.authorization_endpoint, `${SITE}/api/oauth/authorize`);
            assert.equal(metadata.token_endpoint, `${SITE}/api/oauth/token`);
            assert.equal(metadata.client_id_metadata_document_supported, true);
            assert.ok(metadata.token_endpoint_auth_methods_supported.includes("none"));
            assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
            assert.ok(metadata.registration_endpoint);
        });

        it("answers an MCP request without a token with the 401 that starts sign-in", async () => {
            const response = await initialize(null);

            assert.equal(response.status, 401);
            const challenge = response.headers.get("www-authenticate");
            assert.match(challenge, /^Bearer /);
            assert.match(challenge, /resource_metadata="http:\/\/localhost:5173\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
            assert.doesNotMatch(challenge, /error=/);
        });

        it("says the token is no good when one is sent that isn't", async () => {
            const response = await initialize("nka_made-up");

            assert.equal(response.status, 401);
            assert.match(response.headers.get("www-authenticate"), /error="invalid_token"/);
        });
    });

    describe("allowing Claude in", () => {
        it("lets nothing but Claude ask, and never sends a refusal to an address it doesn't trust", async () => {
            const { challenge } = pkce();

            const stranger = await raw(
                `/api/oauth/authorize?${authorizeQuery({ client_id: "https://evil.example/client", code_challenge: challenge })}`,
            );
            assert.equal(stranger.headers.get("location"), `${SITE}/connect?problem=client`);

            const elsewhere = await raw(
                `/api/oauth/authorize?${authorizeQuery({ redirect_uri: "https://evil.example/callback", code_challenge: challenge })}`,
            );
            assert.equal(elsewhere.headers.get("location"), `${SITE}/connect?problem=redirect`);

            // Claude Code names itself with another document, with loopback redirects: not let in
            const claudeCode = await raw(
                `/api/oauth/authorize?${authorizeQuery({
                    client_id: "https://claude.ai/oauth/claude-code-client-metadata",
                    redirect_uri: "http://localhost:3118/callback",
                    code_challenge: challenge,
                })}`,
            );
            assert.equal(claudeCode.headers.get("location"), `${SITE}/connect?problem=client`);
        });

        it("sends a request without PKCE back to Claude with an error", async () => {
            const response = await raw(`/api/oauth/authorize?${authorizeQuery({ code_challenge_method: undefined })}`);
            const back = new URL(response.headers.get("location"));

            assert.equal(`${back.origin}${back.pathname}`, CALLBACK);
            assert.equal(back.searchParams.get("error"), "invalid_request");
            assert.equal(back.searchParams.get("state"), "state-123");
            assert.equal(back.searchParams.get("iss"), SITE);
        });

        it("refuses a token for some other server", async () => {
            const { challenge } = pkce();
            const response = await raw(
                `/api/oauth/authorize?${authorizeQuery({ code_challenge: challenge, resource: "https://other.example/mcp" })}`,
            );

            assert.equal(new URL(response.headers.get("location")).searchParams.get("error"), "invalid_target");
        });

        it("needs the person to be signed in to answer", async () => {
            const anonymous = createClient();
            const response = await anonymous.post("/oauth/authorize", { client_id: CLAUDE, approve: true });

            assert.equal(response.status, 401);
        });

        it("sends a refusal back to Claude, with no code", async () => {
            const person = await signedIn();
            const { redirect, code } = await allow(person, { approve: false });

            assert.equal(`${redirect.origin}${redirect.pathname}`, CALLBACK);
            assert.equal(redirect.searchParams.get("error"), "access_denied");
            assert.equal(redirect.searchParams.get("state"), "state-123");
            assert.equal(code, null);
        });

        it("trades the code once, with the right verifier, for tokens bound to the MCP endpoint", async () => {
            const person = createClient();
            const account = await person.register();
            const { redirect, code, verifier } = await allow(person);

            assert.equal(redirect.searchParams.get("state"), "state-123");
            assert.equal(redirect.searchParams.get("iss"), SITE);
            assert.match(code, /^nkc_/);

            const response = await tradeCode(code, verifier);
            assert.equal(response.status, 200);
            assert.equal(response.headers.get("cache-control"), "no-store");
            const tokens = await response.json();
            assert.match(tokens.access_token, /^nka_/);
            assert.match(tokens.refresh_token, /^nkr_/);
            assert.equal(tokens.token_type, "Bearer");
            assert.equal(tokens.expires_in, 3600);

            const user = await User.findOne({ email: account.email });
            const kept = await Connection.findOne({ user: user._id });
            assert.ok(kept);
            assert.equal(kept.resource, MCP_URL);
            assert.notEqual(kept.accessToken, tokens.access_token); // only the hash is kept

            const again = await tradeCode(code, verifier);
            assert.equal(again.status, 400);
            assert.equal((await again.json()).error, "invalid_grant");
        });

        it("refuses the code with the wrong verifier, and the code is spent", async () => {
            const person = await signedIn();
            const { code, verifier } = await allow(person);

            const wrong = await tradeCode(code, pkce().verifier);
            assert.equal(wrong.status, 400);
            assert.equal((await wrong.json()).error, "invalid_grant");

            assert.equal((await tradeCode(code, verifier)).status, 400);
            const hashed = crypto.createHash("sha256").update(code).digest("hex");
            assert.equal(await AuthorizationCode.exists({ _id: hashed }), null);
        });

        it("refuses a token request from anyone but Claude", async () => {
            const response = await tradeCode("nkc_whatever", pkce().verifier, { client_id: "someone-else" });

            assert.equal(response.status, 401);
            assert.equal((await response.json()).error, "invalid_client");
        });

        it("registers Claude when it registers itself, and only for Claude's callback", async () => {
            const refused = await raw("/api/oauth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ redirect_uris: ["https://evil.example/callback"], client_name: "Claude" }),
            });
            assert.equal(refused.status, 400);
            assert.equal((await refused.json()).error, "invalid_redirect_uri");

            const registered = await raw("/api/oauth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ redirect_uris: [CALLBACK], client_name: "Claude", token_endpoint_auth_method: "client_secret_post" }),
            });
            assert.equal(registered.status, 201);
            const client = await registered.json();
            assert.match(client.client_id, /^claude-/);
            assert.equal(client.token_endpoint_auth_method, "none");

            const person = await signedIn();
            const tokens = await connect(person, { clientId: client.client_id });
            assert.equal((await initialize(tokens.access_token)).status, 200);
        });
    });

    describe("refreshing", () => {
        it("swaps both tokens, and the old access token stops working", async () => {
            const person = await signedIn();
            const first = await connect(person);

            const response = await refreshWith(first.refresh_token);
            assert.equal(response.status, 200);
            const second = await response.json();
            assert.notEqual(second.access_token, first.access_token);
            assert.notEqual(second.refresh_token, first.refresh_token);

            assert.equal((await initialize(first.access_token)).status, 401);
            assert.equal((await initialize(second.access_token)).status, 200);
        });

        it("still takes the refresh token just replaced, for an answer that never arrived", async () => {
            const person = await signedIn();
            const first = await connect(person);

            assert.equal((await refreshWith(first.refresh_token)).status, 200);
            const retried = await refreshWith(first.refresh_token);
            assert.equal(retried.status, 200);
            const latest = await retried.json();
            assert.equal((await initialize(latest.access_token)).status, 200);
        });

        it("refuses an old refresh token once the grace is over, with invalid_grant", async () => {
            const person = await signedIn();
            const first = await connect(person);
            const second = await (await refreshWith(first.refresh_token)).json();

            // Ten minutes on: the grace for the replaced token is long over
            await Connection.updateMany({ rotatedAt: { $ne: null } }, { $set: { rotatedAt: new Date(Date.now() - 10 * 60 * 1000) } });

            const stale = await refreshWith(first.refresh_token);
            assert.equal(stale.status, 400);
            assert.equal((await stale.json()).error, "invalid_grant");
            assert.equal((await refreshWith(second.refresh_token)).status, 200);
        });

        it("ends the connection when Claude revokes a token", async () => {
            const person = await signedIn();
            const tokens = await connect(person);

            const response = await formPost("/api/oauth/revoke", { token: tokens.refresh_token });
            assert.equal(response.status, 200);
            assert.equal((await initialize(tokens.access_token)).status, 401);
        });
    });

    describe("acting in the account", () => {
        it("serves the tools, and none for the account's own settings", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);

            const started = await initialize(token);
            assert.equal(started.status, 200);
            assert.equal(started.body.result.serverInfo.name, "nityakram");
            assert.match(started.body.result.instructions, /Trash/);

            const listed = await mcp(token, "tools/list");
            const names = listed.body.result.tools.map((tool) => tool.name);
            for (const name of ["get_today", "get_plan", "add_routines", "add_habits", "add_todos", "add_transactions", "update_week", "restore_from_trash"]) {
                assert.ok(names.includes(name), name);
            }
            assert.ok(!names.some((name) => /password|account_delete|delete_account|empty|erase|logout/.test(name)));

            const today = listed.body.result.tools.find((tool) => tool.name === "get_today");
            assert.equal(today.annotations.readOnlyHint, true);
        });

        it("adds routines and habits that the app then has, and reads them back", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);

            const added = await callTool(token, "add_routines", {
                routines: [
                    { title: "Morning walk", startTime: "06:30", endTime: "07:15", isRecurring: true, recurringDays: [1, 2, 3, 4, 5], category: "fitness" },
                    { title: "Dentist", startTime: "17:00", isRecurring: false, date: "2099-01-05" },
                ],
            });
            assert.equal(added.isError, false);
            assert.equal(added.data.added.length, 2);
            assert.ok(added.data.added[0].id);
            assert.equal(added.data.added[0].user, undefined); // the owner isn't shown to Claude

            const habits = await callTool(token, "add_habits", {
                habits: [{ title: "Read", habitType: "quantity", targetQuantity: 20, unit: "pages", timeOfDay: "evening" }],
            });
            assert.equal(habits.data.added[0].title, "Read");

            // The app itself has them: the same account, read through the website's own route
            const all = await person.get("/routines/all");
            assert.deepEqual(all.body.routines.map((routine) => routine.title).sort(), ["Dentist", "Morning walk"]);

            const plan = await callTool(token, "get_plan");
            assert.equal(plan.data.routines.length, 2);
            assert.equal(plan.data.habits.length, 1);
            assert.match(plan.data.today, /^\d{4}-\d{2}-\d{2}$/);
        });

        it("says which of several failed and why, in the app's own words", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);

            const result = await callTool(token, "add_todos", {
                todos: [{ title: "Buy milk" }, { title: "Yesterday's thing", date: "2000-01-01" }],
            });
            assert.equal(result.isError, false);
            assert.equal(result.data.added.length, 1);
            assert.equal(result.data.failed.length, 1);
            assert.equal(result.data.failed[0].index, 1);
            assert.ok(result.data.failed[0].error);

            const missing = await callTool(token, "update_routine", { id: "aaaaaaaaaaaaaaaaaaaaaaaa", title: "Nope" });
            assert.equal(missing.isError, true);
            assert.match(missing.data, /not found/i);
        });

        it("marks a routine done and earns its XP, the same as the app", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);
            const added = await callTool(token, "add_routines", {
                routines: [{ title: "Stretch", startTime: "00:00", isRecurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6] }],
            });

            const done = await callTool(token, "complete_routine", { id: added.data.added[0].id });
            assert.equal(done.isError, false, JSON.stringify(done.data));

            const today = await callTool(token, "get_today");
            assert.ok(today.data.routines[0].todayLog);
            // Its 10, and whatever the day's first completion brings with it in the app (a bonus)
            const earned = (await callTool(token, "get_progress")).data.stats.totalXp;
            assert.ok(earned >= 10, String(earned));

            assert.equal((await callTool(token, "uncomplete_routine", { id: added.data.added[0].id })).isError, false);
            assert.ok((await callTool(token, "get_progress")).data.stats.totalXp < earned);
            assert.equal((await callTool(token, "get_today")).data.routines[0].todayLog, null);
        });

        it("deletes to Trash and brings back, and can't empty Trash", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);
            const added = await callTool(token, "add_habits", { habits: [{ title: "Floss" }] });
            const habitId = added.data.added[0].id;

            assert.equal((await callTool(token, "delete_item", { kind: "habit", id: habitId })).isError, false);
            const trash = await callTool(token, "get_trash");
            assert.ok(JSON.stringify(trash.data).includes(habitId));

            assert.equal((await callTool(token, "restore_from_trash", { kind: "habit", id: habitId })).isError, false);
            const plan = await callTool(token, "get_plan");
            assert.deepEqual(plan.data.habits.map((habit) => habit.title), ["Floss"]);
        });

        it("rejects arguments that don't fit a tool before anything is sent", async () => {
            const person = await signedIn();
            const { access_token: token } = await connect(person);

            const result = await callTool(token, "add_routines", { routines: [{ title: "Bad", startTime: "7am" }] });
            assert.equal(result.isError, true);
            assert.equal(await Routine.countDocuments({ title: "Bad" }), 0);
        });

        it("acts only in the account that allowed it", async () => {
            const alice = await signedIn();
            const bob = await signedIn();
            const { access_token: aliceToken } = await connect(alice);
            await bob.post("/routines", { title: "Bob's secret", startTime: "09:00", isRecurring: true, recurringDays: [1] });

            const plan = await callTool(aliceToken, "get_plan");
            assert.equal(plan.data.routines.length, 0);
        });
    });

    describe("ending a connection", () => {
        it("is listed in Settings with the address to add, and disconnecting ends it at once", async () => {
            const person = await signedIn();
            const tokens = await connect(person);

            const listed = await person.get("/connections");
            assert.equal(listed.status, 200);
            assert.equal(listed.body.url, MCP_URL);
            assert.equal(listed.body.connections.length, 1);
            assert.equal(listed.body.connections[0].clientName, "Claude");
            assert.equal(listed.body.connections[0].accessToken, undefined);

            const removed = await person.delete(`/connections/${listed.body.connections[0]._id}`);
            assert.equal(removed.status, 200);
            assert.equal((await initialize(tokens.access_token)).status, 401);
            assert.equal((await refreshWith(tokens.refresh_token)).status, 400);
        });

        it("can't end someone else's", async () => {
            const owner = await signedIn();
            const other = await signedIn();
            await connect(owner);
            const [connection] = (await owner.get("/connections")).body.connections;

            assert.equal((await other.delete(`/connections/${connection._id}`)).status, 404);
            assert.equal((await owner.get("/connections")).body.connections.length, 1);
        });

        it("ends with signing out everywhere", async () => {
            const person = await signedIn();
            const tokens = await connect(person);

            await person.post("/auth/logout-all");
            assert.equal((await initialize(tokens.access_token)).status, 401);
        });

        it("ends with a new password", async () => {
            const person = createClient();
            const account = await person.register();
            const tokens = await connect(person);

            const changed = await person.put("/auth/password", {
                currentPassword: account.password,
                newPassword: `${account.password}-new`,
            });
            assert.equal(changed.status, 200);
            assert.equal((await initialize(tokens.access_token)).status, 401);
        });

        it("goes with the account", async () => {
            const person = createClient();
            const account = await person.register();
            await connect(person);
            const user = await User.findOne({ email: account.email });

            await eraseAccount(user._id);
            assert.equal(await Connection.countDocuments({ user: user._id }), 0);
        });
    });
});
