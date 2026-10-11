import webpush from "web-push";

// Web Push: how reminders reach a device whose app is closed. It needs a key pair of the server's own
// (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY; `npx web-push generate-vapid-keys` makes one) and a way for the push
// services to reach whoever runs it (VAPID_SUBJECT, a mailto: or https: address). Without the keys reminders are
// only shown while the app is open, by the app itself.

let configured = null;

const subjectOf = () => {
    if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
    if (process.env.CLIENT_URL?.startsWith("https://")) return process.env.CLIENT_URL;
    return "mailto:reminders@localhost";
};

// True once the keys are set and accepted. Read lazily, so the environment is in place by then.
export const isPushConfigured = () => {
    if (configured !== null) return configured;

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        configured = false;
        return configured;
    }

    try {
        webpush.setVapidDetails(subjectOf(), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        configured = true;
    } catch (error) {
        console.error("Push keys were refused:", error.message);
        configured = false;
    }
    return configured;
};

// The key a browser subscribes with, or null when push is not set up
export const publicPushKey = () => (isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null);

/**
 * Sends one message to one device.
 * @param {Object} subscription - { endpoint, keys: { p256dh, auth } }
 * @param {Object} payload - what the service worker shows: { title, body, tag, url }
 * @returns {String} - "sent", or "gone" when the device has unsubscribed (its subscription should be dropped)
 */
export const sendPush = async (subscription, payload) => {
    try {
        await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            JSON.stringify(payload),
            // A reminder that could not be delivered within the hour is no longer worth delivering
            { TTL: 60 * 60, urgency: "high" },
        );
        return "sent";
    } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) return "gone";
        throw error;
    }
};
