import "./env.js";

import crypto from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";

import {
    emailsTo,
    startEmailServer,
    stopEmailServer,
    tokenIn,
} from "./email.js";

// Integration tests need a MongoDB of their own, named in MONGO_URI_TEST.
// Without it they are skipped and only the unit tests run.
export const TEST_DATABASE_URI = process.env.MONGO_URI_TEST;
export const skipWithoutDatabase = TEST_DATABASE_URI
    ? false
    : "MONGO_URI_TEST is not set";

let server;
let baseUrl;

// Starts the app on a free port, connected to the test database
export const startApp = async () => {
    // The app is loaded only now, once the stand-in email server is there for it to talk to
    await startEmailServer();
    const { default: app } = await import("../../app.js");

    if (TEST_DATABASE_URI) {
        await mongoose.connect(TEST_DATABASE_URI);

        // Tests create and change data freely. Never let that happen to a real database.
        const name = mongoose.connection.name;
        if (!name.endsWith("_test")) {
            await mongoose.disconnect();
            throw new Error(
                `Refusing to run tests against "${name}": the database name must end in "_test".`,
            );
        }

        // Unique indexes have to exist before tests rely on them
        await Promise.all(
            Object.values(mongoose.models).map((model) => model.init()),
        );
    }

    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
};

export const stopApp = async () => {
    server?.close();
    stopEmailServer();
    await mongoose.disconnect();
};

export const uniqueEmail = (label = "user") =>
    `${label}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}@example.com`;

let clientCount = 0;

/**
 * A browser-like client: it keeps its own refresh cookie and access token,
 * and reports its own timezone and network address.
 */
export const createClient = ({ timezone = "Asia/Kolkata" } = {}) => {
    clientCount += 1;
    const address = `10.1.${Math.floor(clientCount / 250)}.${(clientCount % 250) + 1}`;

    const client = {
        timezone,
        accessToken: null,
        refreshCookie: null,

        async request(method, path, body, { cookie, headers = {} } = {}) {
            const sentCookie = cookie ?? client.refreshCookie;

            const response = await fetch(`${baseUrl}/api${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "X-Test-Client-IP": address,
                    ...(client.timezone ? { "X-Timezone": client.timezone } : {}),
                    ...(client.accessToken
                        ? { Authorization: `Bearer ${client.accessToken}` }
                        : {}),
                    ...(sentCookie ? { Cookie: `refreshToken=${sentCookie}` } : {}),
                    ...headers,
                },
                body:
                    typeof body === "string"
                        ? body
                        : body === undefined
                          ? undefined
                          : JSON.stringify(body),
            });

            const setCookie = response.headers
                .getSetCookie()
                .find((value) => value.startsWith("refreshToken="));
            const text = await response.text();
            let json = {};
            try {
                json = JSON.parse(text);
            } catch {
                // not JSON (the CSV export)
            }

            return {
                status: response.status,
                body: json,
                text,
                headers: response.headers,
                setCookie,
                cookie: setCookie?.split(";")[0].slice("refreshToken=".length),
            };
        },

        get: (path, options) => client.request("GET", path, undefined, options),
        post: (path, body, options) => client.request("POST", path, body ?? {}, options),
        put: (path, body, options) => client.request("PUT", path, body ?? {}, options),
        delete: (path, body, options) => client.request("DELETE", path, body ?? {}, options),

        // Signs up only: the account stays unusable until the emailed link is opened
        async signUp(overrides = {}) {
            const credentials = {
                name: "Test User",
                email: uniqueEmail(),
                password: crypto.randomBytes(12).toString("base64url"),
                ...overrides,
            };
            const response = await client.post("/auth/register", credentials);

            return { ...credentials, response };
        },

        async login({ email, password }) {
            const response = await client.post("/auth/login", { email, password });
            client.accessToken = response.body.accessToken;
            client.refreshCookie = response.cookie;

            return response;
        },

        // Signs up a fresh account, confirms its email through the emailed link, and stays logged in as it
        async register(overrides = {}) {
            const account = await client.signUp(overrides);
            if (account.response.status !== 201) {
                return account;
            }

            const token = tokenIn(emailsTo(account.email).at(-1));
            await client.post(`/auth/verify-email/${token}`);
            const login = await client.login(account);

            return { ...account, login, user: login.body.user };
        },
    };

    return client;
};

// "YYYY-MM-DD" right now in a timezone, worked out without the app's own date helpers
export const todayIn = (timezone) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());

export const addDays = (dateString, days) =>
    new Date(Date.parse(`${dateString}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10);
