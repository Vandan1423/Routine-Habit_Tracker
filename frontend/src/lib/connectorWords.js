// The Claude connector in words: what the Connect page and Settings say, and how the Connect page reads the
// request it is opened with. No React here.

import { APP_NAME } from "./app";
import { formatDayShort, localDay } from "./dates";

// The authorization request, as the server passes it on to /connect (see connectorController.js). It goes back
// to the server with the answer, which checks all of it again.
const REQUEST_FIELDS = [
    "response_type",
    "client_id",
    "redirect_uri",
    "code_challenge",
    "code_challenge_method",
    "state",
    "scope",
    "resource",
];

/**
 * What /connect was opened with.
 * @returns {Object} - { request } to ask the person about, or { problem }: "client", "redirect" or "missing"
 */
export const readConnectRequest = (search) => {
    const params = new URLSearchParams(search);
    const problem = params.get("problem");
    if (problem) return { problem: problem === "redirect" ? "redirect" : "client" };

    const request = Object.fromEntries(
        REQUEST_FIELDS.map((field) => [field, params.get(field)]).filter(([, value]) => value),
    );
    return request.client_id && request.redirect_uri ? { request } : { problem: "missing" };
};

export const PROBLEM_WORDS = {
    client: `Only Claude can connect to ${APP_NAME}, and this request came from somewhere else. Nothing was shared.`,
    redirect: "The request asked to send you somewhere that isn’t Claude, so it was stopped. Nothing was shared.",
    missing: "Claude opens this page when you connect it. Start from Claude: add the connector there, then sign in.",
};

// The host the person goes back to after answering (the MCP specification asks for it to be shown)
export const returnHost = (redirectUri) => {
    try {
        return new URL(redirectUri).host;
    } catch {
        return "";
    }
};

export const CLAUDE_CAN = [
    "See your plan, your days and history, to-dos, weeks, goals and expenses",
    "Add, change and tick off routines, habits and to-dos",
    "Plan your weeks, set goals and log expenses",
    "Move things to Trash, and bring them back",
];

export const CLAUDE_CANNOT = [
    "Change your password or delete your account",
    "Empty Trash or erase anything for good",
];

export const STAKES_NOTE =
    "What Claude adds counts from today, and what it ticks off earns XP, just as when you do it yourself.";

// "Connected 17 Oct · last used today"
export const connectionWords = ({ createdAt, lastUsedAt }, today = localDay()) => {
    const dayWords = (moment) => {
        const day = localDay(new Date(moment));
        return day === today ? "today" : formatDayShort(day);
    };

    const connected = `Connected ${dayWords(createdAt)}`;
    return lastUsedAt ? `${connected} · last used ${dayWords(lastUsedAt)}` : `${connected} · not used yet`;
};

export const CONNECT_NOTE =
    "Plan from a chat: Claude can read your plan and add, change and tick off routines, habits, to-dos, goals and expenses. " +
    "In Claude, open Settings, then Connectors, choose “Add custom connector” and paste this address.";
