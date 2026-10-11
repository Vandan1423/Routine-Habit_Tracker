// The app's service worker. It does one thing: shows reminders. It caches nothing and answers no requests,
// so the app loads exactly as it does without it.
//
// A reminder can reach a device twice: pushed by the server (when push is set up there), and shown by the app
// itself while it is open (src/lib/notify.js). Both are tagged with the reminder's own key, and both note the
// key here, in a cache of its own, once shown: whichever comes second finds it and stays quiet.

const SHOWN = "nityakram-reminders-shown";
const shownKey = (tag) => `/__reminders__/${encodeURIComponent(tag)}`;
// A reminder's key names its day, so after a few days nothing will ask about it again
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

const forgetOld = async (cache) => {
    for (const request of await cache.keys()) {
        const shown = Number(await (await cache.match(request))?.text());
        if (!(Date.now() - shown < KEEP_MS)) await cache.delete(request);
    }
};

const showOnce = async ({ title, body, tag, url }) => {
    const cache = await caches.open(SHOWN);
    if (tag && (await cache.match(shownKey(tag)))) return;
    if (tag) {
        await cache.put(shownKey(tag), new Response(String(Date.now())));
        await forgetOld(cache);
    }

    await self.registration.showNotification(title || "नित्यक्रम", {
        body: body || "",
        tag: tag || undefined,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        data: { url: url || "/today" },
    });
};

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let message;
    try {
        message = event.data ? event.data.json() : {};
    } catch {
        message = { body: event.data ? event.data.text() : "" };
    }

    event.waitUntil(showOnce(message));
});

// Pressing a reminder opens the app where it points, in a window already open if there is one
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL(event.notification.data?.url || "/today", self.location.origin).href;

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            const open = windows.find((client) => client.url.startsWith(self.location.origin));

            if (open) {
                await open.focus();
                if ("navigate" in open && open.url !== url) await open.navigate(url).catch(() => {});
                return;
            }
            await self.clients.openWindow(url);
        })(),
    );
});
