import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

// The parts of the API Claude's tools may reach. Account and security routes (/auth), the connector's own
// (/oauth, /connections, /mcp), devices (/notifications) and the schedulers (/jobs) are not among them.
const OPEN_TO_CLAUDE = [
    "/api/routines",
    "/api/habits",
    "/api/todos",
    "/api/weeks",
    "/api/goals",
    "/api/expenses",
    "/api/history",
    "/api/gamification",
    "/api/streaks",
    "/api/trash",
    "/api/archive",
];

const reachable = (method, path) => {
    const open = OPEN_TO_CLAUDE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    // A DELETE on Trash lets go of things for good (emptying it, erasing one). Looking and bringing back are fine.
    const erases = method === "DELETE" && (path === "/api/trash" || path.startsWith("/api/trash/"));
    return open && !erases;
};

const queryString = (query) => {
    const given = Object.entries(query ?? {}).filter(([, value]) => value !== undefined && value !== null);
    return given.length ? `?${new URLSearchParams(given.map(([key, value]) => [key, String(value)]))}` : "";
};

/**
 * Sends one request through the app itself, signed in as the person, and resolves with what it answered.
 * It takes the same path as a request from the website (validation, ownership, the day settled first), so
 * nothing the app decides is decided again here. Nothing goes over the network: Express handles it in place.
 * @param {Function} app - the Express app (req.app)
 * @param {String} token - an access token of the app's own, for the person
 * @param {Object} request - method, path ("/api/routines"), query, body
 * @returns {Promise<Object>} - status, and body: the JSON the app answered with
 */
export const callApp = (app, token, { method, path, query, body }) =>
    new Promise((resolve, reject) => {
        if (!reachable(method, path)) {
            reject(new Error(`${method} ${path} is not open to Claude.`));
            return;
        }

        const socket = new Socket();
        const req = new IncomingMessage(socket);
        req.method = method;
        req.url = path + queryString(query);
        req.headers = { authorization: `Bearer ${token}`, accept: "application/json" };
        // Already parsed: the body parsers see no body to read and leave this as it is
        req.body = body ?? {};

        const res = new ServerResponse(req);
        const chunks = [];
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            socket.destroy();

            const text = Buffer.concat(chunks).toString("utf8");
            let json = {};
            try {
                json = text ? JSON.parse(text) : {};
            } catch {
                json = { message: text };
            }
            resolve({ status: res.statusCode, body: json });
        };

        // Express writes its answer through these; it is collected here instead of going to a socket
        res.write = (chunk, encoding) => {
            if (chunk) chunks.push(Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
            return true;
        };
        res.end = (chunk, encoding) => {
            if (chunk && typeof chunk !== "function") {
                chunks.push(Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
            }
            finish();
            return res;
        };

        // Only reached if nothing answered at all; the app's own 404 and error handlers normally do
        app.handle(req, res, (error) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({
                status: error ? 500 : 404,
                body: { message: error ? "Something went wrong. Please try again." : "Not found." },
            });
        });
    });
