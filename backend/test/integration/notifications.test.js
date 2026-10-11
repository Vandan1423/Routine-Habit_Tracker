import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";
import User from "../../src/models/User.js";
import PushSubscription from "../../src/models/PushSubscription.js";
import { sendDueReminders } from "../../src/utils/reminders.js";

// Reminders: the devices an account gets them on, and the job that sends them, each one once.
// No push keys are set in tests, so messages are handed to a stand-in sender instead of a push service.

const TZ = "Asia/Kolkata";
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe("notifications", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    // A moment of today, in the users' own timezone
    const todayAt = (time) => new Date(`${today}T${time}:00+05:30`);

    before(startApp);
    after(stopApp);

    let deviceCount = 0;
    const device = () => {
        deviceCount += 1;
        return {
            endpoint: `https://push.example.com/send/${Date.now()}-${deviceCount}`,
            keys: { p256dh: "BPublicKeyOfTheDevice", auth: "secret" },
        };
    };

    const setup = async () => {
        const client = createClient({ timezone: TZ });
        const { email } = await client.register();
        const user = await User.findOne({ email });
        return { client, user };
    };

    // Collects what would have been sent: [{ endpoint, payload }]
    const recorder = () => {
        const sent = [];
        const send = async (subscription, payload) => {
            sent.push({ endpoint: subscription.endpoint, payload });
            return "sent";
        };
        return { sent, send };
    };

    it("needs a session", async () => {
        const stranger = createClient();
        assert.equal((await stranger.get("/notifications/config")).status, 401);
        assert.equal((await stranger.post("/notifications/subscriptions", { subscription: device() })).status, 401);
        assert.equal((await stranger.post("/notifications/test")).status, 401);
    });

    it("says when the server sends no push messages", async () => {
        const { client } = await setup();

        assert.deepEqual((await client.get("/notifications/config")).body, { publicKey: null });
        assert.equal((await client.post("/notifications/test")).status, 503);
    });

    it("keeps a device once, moves it to whoever signs in on it, and lets only its owner drop it", async () => {
        const first = await setup();
        const second = await setup();
        const phone = device();

        assert.equal((await first.client.post("/notifications/subscriptions", { subscription: phone })).status, 201);
        assert.equal((await first.client.post("/notifications/subscriptions", { subscription: phone })).status, 201);
        assert.equal(await PushSubscription.countDocuments({ endpoint: phone.endpoint }), 1);

        await second.client.post("/notifications/subscriptions", { subscription: phone });
        const held = await PushSubscription.findOne({ endpoint: phone.endpoint });
        assert.equal(held.user.toString(), second.user._id.toString());

        await first.client.delete("/notifications/subscriptions", { endpoint: phone.endpoint });
        assert.equal(await PushSubscription.countDocuments({ endpoint: phone.endpoint }), 1);
        await second.client.delete("/notifications/subscriptions", { endpoint: phone.endpoint });
        assert.equal(await PushSubscription.countDocuments({ endpoint: phone.endpoint }), 0);
    });

    it("refuses a subscription that is not one", async () => {
        const { client } = await setup();

        const plain = { ...device(), endpoint: "http://push.example.com/insecure" };
        assert.equal((await client.post("/notifications/subscriptions", { subscription: plain })).status, 400);
        assert.equal((await client.post("/notifications/subscriptions", { subscription: { endpoint: device().endpoint } })).status, 400);
    });

    it("takes the account's reminder settings", async () => {
        const { client } = await setup();

        const changed = await client.put("/auth/me", { reminderLead: 30, remindHabits: false });
        assert.equal(changed.status, 200);
        assert.deepEqual([changed.body.user.reminderLead, changed.body.user.remindHabits], [30, false]);
        assert.equal((await client.put("/auth/me", { reminderLead: 7 })).status, 400);
    });

    it("sends a routine's reminder to every device, once, and nothing for one that is paused", async () => {
        const { client } = await setup();
        const [phone, laptop] = [device(), device()];
        await client.post("/notifications/subscriptions", { subscription: phone });
        await client.post("/notifications/subscriptions", { subscription: laptop });

        const study = (await client.post("/routines", { title: "Study", startTime: "12:05", isRecurring: true, recurringDays: EVERY_DAY })).body;
        const walk = (await client.post("/routines", { title: "Walk", startTime: "12:08", isRecurring: true, recurringDays: EVERY_DAY })).body;
        await client.post(`/routines/${walk._id}/pause`, { days: 2 });

        const { sent, send } = recorder();
        await sendDueReminders({ now: todayAt("12:00"), send });

        const mine = sent.filter((entry) => [phone.endpoint, laptop.endpoint].includes(entry.endpoint));
        assert.equal(mine.length, 2);
        assert.deepEqual(mine[0].payload, {
            title: "Study",
            body: "Starts in 5 minutes.",
            url: "/today",
            tag: `routine:${study._id}:${today}`,
        });

        // The next run, a minute later, has nothing new to say
        const again = recorder();
        await sendDueReminders({ now: todayAt("12:01"), send: again.send });
        assert.equal(again.sent.filter((entry) => entry.endpoint === phone.endpoint).length, 0);
    });

    it("drops a device the push service says is gone", async () => {
        const { client } = await setup();
        const phone = device();
        await client.post("/notifications/subscriptions", { subscription: phone });
        await client.post("/habits", { title: "Read", timeOfDay: "afternoon" });

        await sendDueReminders({
            now: todayAt("13:00"),
            send: async (subscription) => (subscription.endpoint === phone.endpoint ? "gone" : "sent"),
        });
        assert.equal(await PushSubscription.countDocuments({ endpoint: phone.endpoint }), 0);
    });

    it("forgets every device of an account that signs out everywhere", async () => {
        const { client, user } = await setup();
        await client.post("/notifications/subscriptions", { subscription: device() });

        await client.post("/auth/logout-all");
        assert.equal(await PushSubscription.countDocuments({ user: user._id }), 0);
    });
});
