// A throwaway copy of the API for checking the interface by hand: its own MongoDB on this machine,
// made-up secrets, email confirmation off and no way to send email. It never reads backend/.env.
//
//   npm run sandbox               start it, with the demo accounts rebuilt (see seedDemo.js)
//   npm run sandbox -- --keep     start it and leave the data as it is
//   npm run sandbox -- --slot 1   a second sandbox beside the first, one port up, with its own database
//   npm run sandbox -- --web      start the web app for this sandbox as well, so one command runs both
//   npm run sandbox -- --mail     ask new accounts to confirm their email, and catch every email the API
//                                 sends on this machine instead of sending it: each one's link is printed
//                                 here, and http://127.0.0.1:8025 (one port up per slot) shows the emails
//
// The web app reaches it through `vite --mode sandbox` on port 5174 (see frontend/vite.config.js),
// or `vite --mode sandbox-1` on 5175 for slot 1. With --web this script starts that itself.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Slot 0 unless told otherwise. Each slot is a whole sandbox of its own, so two can run at once
// (one may be serving older code that something else is still looking at).
const slotArgument = process.argv.indexOf("--slot");
const SLOT = slotArgument === -1 ? 0 : Number(process.argv[slotArgument + 1]);
if (!Number.isInteger(SLOT) || SLOT < 0 || SLOT > 9) {
    console.error("--slot takes a number from 0 to 9.");
    process.exit(1);
}

const DATABASE_PORT = 27027 + SLOT;
const API_PORT = 4010 + SLOT;
const WEB_PORT = 5174 + SLOT;
const MAIL_PORT = 8025 + SLOT;
const CATCHES_MAIL = process.argv.includes("--mail");
const DATABASE_URI = `mongodb://127.0.0.1:${DATABASE_PORT}/routine_habit_test`;

// Set before the app is loaded. app.js would read .env; it is pointed at an empty file instead,
// and every setting .env holds is given a harmless value here.
Object.assign(process.env, {
    DOTENV_CONFIG_PATH: os.devNull,
    DOTENV_CONFIG_QUIET: "true",
    NODE_ENV: "development",
    PORT: String(API_PORT),
    CLIENT_URL: `http://localhost:${WEB_PORT}`,
    MONGO_URI: DATABASE_URI,
    ACCESS_TOKEN_SECRET: "sandbox-access-token-secret",
    REFRESH_TOKEN_SECRET: "sandbox-refresh-token-secret",
    ACCESS_TOKEN_EXPIRY: "15m",
    REFRESH_TOKEN_EXPIRY: "15d",
    EMAIL_VERIFICATION_REQUIRED: CATCHES_MAIL ? "true" : "false",
    EMAIL_FROM: "",
    RESEND_API_KEY: "re_sandbox_key",
    // Nothing listens on port 9, so without --mail an email simply fails to send
    RESEND_BASE_URL: CATCHES_MAIL ? `http://127.0.0.1:${MAIL_PORT}` : "http://127.0.0.1:9",
    GMAIL_CLIENT_ID: "",
    GMAIL_CLIENT_SECRET: "",
    GMAIL_REFRESH_TOKEN: "",
});

const isListening = (port) =>
    new Promise((resolve) => {
        const socket = net.connect(port, "127.0.0.1");
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
    });

let database;
let web;
let mail;
const stop = () => {
    web?.kill();
    database?.kill();
    mail?.close();
    process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

// Its data lives in the system's temporary folder: nothing in the project, nothing worth keeping
if (!(await isListening(DATABASE_PORT))) {
    const dataFolder = path.join(
        os.tmpdir(),
        SLOT ? `routine-habit-sandbox-db-${SLOT}` : "routine-habit-sandbox-db",
    );
    fs.mkdirSync(dataFolder, { recursive: true });

    database = spawn(
        "mongod",
        ["--dbpath", dataFolder, "--port", String(DATABASE_PORT), "--bind_ip", "127.0.0.1"],
        { stdio: "ignore" },
    );
    database.once("error", () => {
        console.error("The sandbox needs MongoDB (mongod) installed on this machine.");
        process.exit(1);
    });

    for (let attempt = 0; !(await isListening(DATABASE_PORT)); attempt++) {
        if (attempt > 150) {
            console.error(`mongod did not start on port ${DATABASE_PORT}.`);
            stop();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

// Stands in for Resend, as test/helpers/email.js does for the tests: the API reaches it through the real
// Resend client, so each email is built exactly as it would be sent, and is kept here to be looked at.
if (CATCHES_MAIL) {
    const emails = [];
    const page = (body) =>
        `<!doctype html><meta charset="utf-8"><title>Sandbox emails</title><body style="font: 14px/1.6 system-ui; margin: 32px">${body}`;
    const plain = (value) => String(value).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

    mail = http.createServer(async (req, res) => {
        if (req.method === "POST") {
            let body = "";
            for await (const chunk of req) body += chunk;

            const email = JSON.parse(body);
            emails.push(email);
            console.log(
                `Email ${emails.length} to ${email.to}: "${email.subject}"\n  ${email.html.match(/href="([^"]+)"/)?.[1] ?? "(no link)"}`,
            );
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ id: `sandbox-email-${emails.length}` }));
            return;
        }

        // /3 is the third email as its reader would see it, /3.txt its plain-text copy, /last the newest
        const [, which, asText] = /^\/(\d+|last)(\.txt)?$/.exec(req.url) ?? [];
        const email = which === "last" ? emails.at(-1) : emails[Number(which) - 1];

        if (email) {
            res.setHeader("Content-Type", `${asText ? "text/plain" : "text/html"}; charset=utf-8`);
            res.end(asText ? email.text : email.html);
            return;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.statusCode = which ? 404 : 200;
        res.end(
            page(
                emails.length === 0
                    ? "No email has been sent yet."
                    : emails
                          .map(
                              (entry, index) =>
                                  `<p>${index + 1}. <a href="/${index + 1}">${plain(entry.subject)}</a> to ${plain(entry.to)} (<a href="/${index + 1}.txt">plain text</a>)</p>`,
                          )
                          .reverse()
                          .join(""),
            ),
        );
    });
    mail.listen(MAIL_PORT, "127.0.0.1", () => {
        console.log(`Emails are caught on http://127.0.0.1:${MAIL_PORT}`);
    });
}

const { default: mongoose } = await import("mongoose");
await mongoose.connect(DATABASE_URI);

if (!process.argv.includes("--keep")) {
    const { seedDemo } = await import("./seedDemo.js");
    console.log("Demo accounts:", await seedDemo());
}

const { default: app } = await import("../app.js");
app.listen(API_PORT, "127.0.0.1", () => {
    console.log(`Sandbox API on http://127.0.0.1:${API_PORT}, database ${DATABASE_URI}`);
});

// The web app for this slot, from the frontend's own copy of Vite
if (process.argv.includes("--web")) {
    const frontend = fileURLToPath(new URL("../../frontend", import.meta.url));

    web = spawn(
        process.execPath,
        [
            path.join(frontend, "node_modules/vite/bin/vite.js"),
            frontend,
            "--mode",
            SLOT ? `sandbox-${SLOT}` : "sandbox",
            "--port",
            String(WEB_PORT),
            "--strictPort",
        ],
        { stdio: "inherit" },
    );
    web.once("exit", stop);
}
