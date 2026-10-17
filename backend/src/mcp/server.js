import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";

import { TOOLS } from "./tools.js";

// What Claude is told about the app before it uses any tool: the rules a person learns by using it
const INSTRUCTIONS = `Nityakram (नित्यक्रम) is the person's daily planner. You act in their account as they would in the app.

- Days are the person's own, in their timezone: get_today gives today's date. Dates are YYYY-MM-DD, times HH:MM on a 24-hour clock, weekdays 0 (Sunday) to 6 (Saturday).
- Routines happen at a time of day, repeating on chosen weekdays or once on a date. Habits have no clock time: they are kept during a part of the day, every day or on chosen weekdays, either done-or-not or counted towards a target.
- The app keeps score. A routine done earns 10 XP (half if done more than 15 minutes after its end time); a habit earns 10, 15 or 25 by difficulty. Whatever is left undone when the day closes costs XP: half a routine's worth, a third of a habit's. Anything added counts from the day it is added, so a routine added today whose time has passed is owed tonight. Say so when it applies, and only mark things done when the person says they did them.
- To-dos carry no XP and no penalty. They live on lists and can be planned for a day and a time. Each week has a page with a focus list, notes and a review.
- Before building a plan, read get_plan so new things fit around what is there and nothing is added twice. Propose the plan and let the person agree to it before adding many things at once.
- Deleting moves things to Trash, and restore_from_trash brings them back. Ask before deleting. You cannot empty Trash, erase anything for good, change the password or delete the account: the person does those in the app.
- Money is in the account's currency, rupees unless the account says otherwise. get_expenses lists the accounts; every transaction needs one.`;

// One server per request, acting for whoever the request's token belongs to (connectorMiddleware.js puts the way
// to reach the app as that person in authInfo). Nothing is kept between requests, so any copy of the function
// can answer any request.
const serverFor = ({ authInfo }) => {
    const call = authInfo?.extra?.callApp;
    if (typeof call !== "function") {
        throw new Error("An MCP request arrived without a signed-in person.");
    }

    const server = new McpServer(
        { name: "nityakram", title: "Nityakram", version: "1.0.0" },
        { instructions: INSTRUCTIONS },
    );

    for (const { name, title, description, input, annotations, run } of TOOLS) {
        server.registerTool(
            name,
            { title, description, annotations, ...(input ? { inputSchema: input } : {}) },
            // With an input schema the arguments come first; without one, only the request's context does
            (...params) => run(input ? params[0] : {}, call),
        );
    }

    return server;
};

// Each tool call is one request and one answer, which suits a function that stops between requests. No tool sends
// anything before its result, so the answer is a single message: plain JSON for 2026 clients, and one SSE event
// that ends at once for 2025 ones (the stateless form of that version).
const handler = createMcpHandler(serverFor, {
    onerror: (error) => console.error("MCP error:", error),
});

// For Express: (req, res, parsedBody). req.auth becomes the authInfo above.
export const serveMcp = toNodeHandler(handler, {
    onerror: (error) => console.error("MCP request error:", error),
});
