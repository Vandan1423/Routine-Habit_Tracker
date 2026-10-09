import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import { OWNED_MODELS } from "../../src/utils/eraseAccount.js";

// What a signed-in person may change about their own account: its name, its password, and whether it exists

describe("the account", { skip: skipWithoutDatabase }, () => {
    before(startApp);
    after(stopApp);

    const refresh = (client, cookie) =>
        client.post("/auth/refresh-token", {}, { cookie });

    // A second device signed in to the same account
    const anotherDevice = async (account) => {
        const device = createClient();
        await device.login(account);
        return device;
    };

    it("is closed to anyone who is not signed in", async () => {
        const stranger = createClient();

        assert.equal((await stranger.put("/auth/me", { name: "Nobody" })).status, 401);
        assert.equal((await stranger.put("/auth/password", { currentPassword: "a", newPassword: "bbbbbb" })).status, 401);
        assert.equal((await stranger.post("/auth/delete-account", { password: "a" })).status, 401);
    });

    describe("the name", () => {
        it("is changed, trimmed, and comes back with the account", async () => {
            const client = createClient();
            await client.register();

            const response = await client.put("/auth/me", { name: "  Asha Rao  " });
            assert.equal(response.status, 200);
            assert.equal(response.body.user.name, "Asha Rao");
            assert.equal(response.body.user.password, undefined);
            assert.equal(response.body.user.refreshTokens, undefined);

            assert.equal((await client.get("/auth/me")).body.user.name, "Asha Rao");
        });

        it("follows the rules a name has at sign-up", async () => {
            const client = createClient();
            const { user } = await client.register();

            for (const name of ["", " ", "A", "x".repeat(51), 42, null]) {
                const response = await client.put("/auth/me", { name });
                assert.equal(response.status, 400, `accepted ${JSON.stringify(name)}`);
            }
            assert.equal((await client.put("/auth/me", {})).status, 400);

            assert.equal((await client.get("/auth/me")).body.user.name, user.name);
        });

        it("changes nothing else, whatever is sent with it", async () => {
            const client = createClient();
            const { email } = await client.register();

            const response = await client.put("/auth/me", {
                name: "Still me",
                email: "someone-else@example.com",
                xp: 99999,
                level: 50,
                coins: 5000,
                emailVerified: false,
                timezone: "Pacific/Kiritimati",
            });
            assert.equal(response.status, 200);

            const stored = await User.findOne({ email });
            assert.equal(stored.name, "Still me");
            assert.equal(stored.xp, 0);
            assert.equal(stored.level, 1);
            assert.equal(stored.coins, 0);
            assert.equal(stored.emailVerified, true);
            assert.equal(stored.timezone, "Asia/Kolkata");
        });
    });

    describe("the password", () => {
        it("is changed only by someone who knows the current one", async () => {
            const client = createClient();
            const account = await client.register();

            const wrong = await client.put("/auth/password", { currentPassword: "not-the-password", newPassword: "a-new-password" });
            assert.equal(wrong.status, 400);
            assert.equal(wrong.body.code, "WRONG_PASSWORD");
            assert.equal((await createClient().login(account)).status, 200);

            const right = await client.put("/auth/password", { currentPassword: account.password, newPassword: "a-new-password" });
            assert.equal(right.status, 200);

            assert.equal((await createClient().login(account)).status, 400);
            assert.equal((await createClient().login({ ...account, password: "a-new-password" })).status, 200);
        });

        it("has to be a real change, and long enough", async () => {
            const client = createClient();
            const account = await client.register();

            const same = await client.put("/auth/password", { currentPassword: account.password, newPassword: account.password });
            assert.equal(same.status, 400);

            const short = await client.put("/auth/password", { currentPassword: account.password, newPassword: "12345" });
            assert.equal(short.status, 400);

            const missing = await client.put("/auth/password", { newPassword: "a-new-password" });
            assert.equal(missing.status, 400);

            assert.equal((await createClient().login(account)).status, 200);
        });

        it("signs out every other device and keeps this one", async () => {
            const client = createClient();
            const account = await client.register();
            const phone = await anotherDevice(account);

            const changed = await client.put("/auth/password", { currentPassword: account.password, newPassword: "a-new-password" });
            assert.equal(changed.status, 200);

            assert.equal((await refresh(phone, phone.refreshCookie)).status, 401);
            assert.equal((await refresh(client, client.refreshCookie)).status, 200);
        });

        it("keeps this device even when its latest refresh never arrived", async () => {
            const client = createClient();
            const account = await client.register();
            const held = client.refreshCookie;
            // The server has moved on to a new token; the browser still holds the one before it
            await refresh(client, held);

            const changed = await client.put(
                "/auth/password",
                { currentPassword: account.password, newPassword: "a-new-password" },
                { cookie: held },
            );
            assert.equal(changed.status, 200);
            assert.equal((await refresh(client, held)).status, 200);
        });

        it("ends a reset link that was asked for under the old password", async () => {
            const client = createClient();
            const account = await client.register();
            await User.updateOne(
                { email: account.email },
                { passwordResetToken: "a".repeat(64), passwordResetExpiry: Date.now() + 60000 },
            );

            await client.put("/auth/password", { currentPassword: account.password, newPassword: "a-new-password" });

            const stored = await User.findOne({ email: account.email });
            assert.equal(stored.passwordResetToken, undefined);
        });

        it("stops being asked after five wrong guesses", async () => {
            const client = createClient();
            const account = await client.register();
            const guess = () =>
                client.put("/auth/password", { currentPassword: "a-wrong-guess", newPassword: "a-new-password" });

            for (let attempt = 0; attempt < 5; attempt += 1) {
                assert.equal((await guess()).status, 400);
            }
            assert.equal((await guess()).status, 429);

            // The limit follows the account, so the right password from another device waits as well
            const phone = await anotherDevice(account);
            const right = await phone.put("/auth/password", { currentPassword: account.password, newPassword: "a-new-password" });
            assert.equal(right.status, 429);
            assert.equal((await createClient().login(account)).status, 200);
        });
    });

    describe("deleting it", () => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

        // Something in every part of the app that keeps a person's data
        const fill = async (client) => {
            const routine = (await client.post("/routines", { title: "Routine", startTime: "00:00", isRecurring: false, recurringDays: [], date: today })).body;
            const habit = (await client.post("/habits", { title: "Habit" })).body.habit;

            assert.equal((await client.post(`/routines/${routine._id}/complete`)).status, 200);
            assert.equal((await client.put(`/habits/${habit._id}/log`, { quantity: 1 })).status, 200);
            await client.get("/expenses/accounts");
        };

        const countFor = async (userId) => {
            const counts = await Promise.all(
                OWNED_MODELS.map(async (model) => [model.modelName, await model.countDocuments({ user: userId })]),
            );
            return Object.fromEntries(counts);
        };

        it("asks for the password, and leaves everything alone without it", async () => {
            const client = createClient();
            const account = await client.register();
            await fill(client);

            const wrong = await client.post("/auth/delete-account", { password: "not-the-password" });
            assert.equal(wrong.status, 400);
            assert.equal(wrong.body.code, "WRONG_PASSWORD");
            assert.equal((await client.post("/auth/delete-account", {})).status, 400);

            assert.ok(await User.findOne({ email: account.email }));
            const counts = await countFor(account.user._id);
            assert.ok(counts.Routine >= 1 && counts.Habit >= 1);
        });

        it("removes the account and everything in it, and nobody else's", async () => {
            const client = createClient();
            const account = await client.register();
            const phone = await anotherDevice(account);
            await fill(client);

            const neighbour = createClient();
            const other = await neighbour.register();
            await fill(neighbour);
            const before = await countFor(other.user._id);

            const counts = await countFor(account.user._id);
            for (const name of ["Routine", "RoutineLog", "Habit", "HabitLog", "XPLog", "DailyLog"]) {
                assert.ok(counts[name] >= 1, `nothing to delete in ${name}`);
            }

            const deleted = await client.post("/auth/delete-account", { password: account.password });
            assert.equal(deleted.status, 200);
            // The browser is told to drop its refresh cookie
            assert.match(deleted.setCookie, /^refreshToken=;/);

            assert.equal(await User.findOne({ email: account.email }), null);
            for (const [name, count] of Object.entries(await countFor(account.user._id))) {
                assert.equal(count, 0, `${name} still holds something`);
            }
            assert.deepEqual(await countFor(other.user._id), before);

            // Every session is over, on every device
            assert.equal((await client.get("/auth/me")).status, 401);
            assert.equal((await refresh(phone, phone.refreshCookie)).status, 401);
            assert.equal((await createClient().login(account)).status, 400);
        });

        it("leaves the address free to sign up with again", async () => {
            const client = createClient();
            const account = await client.register();
            await client.post("/auth/delete-account", { password: account.password });

            const again = await createClient().register({ email: account.email });
            assert.equal(again.login.status, 200);
            assert.equal(again.user.xp, 0);
        });
    });
});
