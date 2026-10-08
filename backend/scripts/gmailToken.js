// One-time setup for sending the app's emails through a Gmail account.
// It signs that account in with Google and prints the refresh token the server needs.
//
// Before running it, put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env
// (from a "Desktop app" OAuth client in the Google Cloud console), then: npm run gmail:token

import "dotenv/config";
import crypto from "node:crypto";
import http from "node:http";
import { once } from "node:events";

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error(
        "Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env first.",
    );
    process.exit(1);
}

// Google sends the browser back to this machine once the account has agreed
const server = http.createServer();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const redirectUri = `http://127.0.0.1:${server.address().port}`;

// Both tie Google's answer to this run of the script, so nothing else can slip one in
const state = crypto.randomBytes(16).toString("hex");
const codeVerifier = crypto.randomBytes(32).toString("base64url");

const signInUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
signInUrl.search = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    // Sending only: the token can't read, change or delete any mail
    scope: "https://www.googleapis.com/auth/gmail.send",
    code_challenge: crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url"),
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent",
});

console.log(
    `\nOpen this link in your browser and sign in with the Gmail account that should send the app's emails:\n\n${signInUrl}\n\nWaiting for you to finish there...`,
);

const finish = (res, exitCode, pageText, terminalText) => {
    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        Connection: "close", // so the script can end as soon as the page has been shown
    });
    res.end(pageText, () => server.close());
    console.log(`\n${terminalText}\n`);
    process.exitCode = exitCode;
};

server.on("request", async (req, res) => {
    const answer = new URL(req.url, redirectUri);

    // Browsers also ask for things like /favicon.ico
    if (answer.pathname !== "/") {
        res.writeHead(404).end();
        return;
    }

    if (answer.searchParams.get("state") !== state) {
        res.writeHead(400).end("This answer doesn't belong to the running script.");
        return;
    }

    if (!answer.searchParams.get("code")) {
        finish(
            res,
            1,
            "Google did not give access. You can close this tab and look at the terminal.",
            `Google did not give access: ${answer.searchParams.get("error") || "no reason given"}`,
        );
        return;
    }

    let tokens = {};
    let problem;
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            body: new URLSearchParams({
                client_id: GMAIL_CLIENT_ID,
                client_secret: GMAIL_CLIENT_SECRET,
                code: answer.searchParams.get("code"),
                code_verifier: codeVerifier,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
        });
        tokens = await response.json().catch(() => ({}));
        problem = tokens.error_description || tokens.error || response.status;
    } catch (error) {
        problem = error.message;
    }

    if (!tokens.refresh_token) {
        finish(
            res,
            1,
            "Something went wrong. You can close this tab and look at the terminal.",
            `Google did not return a refresh token: ${problem}`,
        );
        return;
    }

    finish(
        res,
        0,
        "Done. You can close this tab and go back to the terminal.",
        [
            "Done. Add this line to backend/.env, and add the same three GMAIL_ settings to the backend on Render:",
            "",
            `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`,
            "",
            "Keep it private: whoever has it can send email as this account.",
        ].join("\n"),
    );
});
