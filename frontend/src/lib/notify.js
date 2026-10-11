// This device's side of reminders: whether it can show them, the permission to, the service worker that shows
// them (public/sw.js), and the push subscription that lets the server reach it while the app is closed.
// Whether reminders are on is this device's own choice, remembered here; how early they come is the account's.

import { forget, readRemembered, remember } from "./remembered";
import notificationService from "../services/notificationService";

const DEVICE_SETTING = "reminders";
const WORKER_URL = "/sw.js";
// Shared with the service worker: a reminder noted here has been shown, by whichever of the two came first
const SHOWN = "nityakram-reminders-shown";
const shownKey = (tag) => `/__reminders__/${encodeURIComponent(tag)}`;

// Whether this browser can show reminders at all
export const canNotify = () =>
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    window.isSecureContext;

// Whether it can be reached by push while the app is closed
export const canPush = () => canNotify() && "PushManager" in window;

// "granted", "denied", "default", or "unsupported"
export const permission = () => (canNotify() ? Notification.permission : "unsupported");

// An iPhone or iPad shows reminders only from the app added to the Home Screen, not from a tab in Safari
export const needsHomeScreen = () => {
    if (typeof navigator === "undefined") return false;
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const installed = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone;
    return apple && !installed;
};

// Whether reminders are on for this device: chosen here, and still allowed by the browser
export const remindersOnHere = () => readRemembered(DEVICE_SETTING, false) === true && permission() === "granted";

// Who wants to know when reminders are turned on or off here (for useSyncExternalStore)
const listeners = new Set();
export const subscribeReminders = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const changed = () => listeners.forEach((listener) => listener());

const worker = async () => {
    const existing = await navigator.serviceWorker.getRegistration(WORKER_URL);
    if (existing) return existing;
    await navigator.serviceWorker.register(WORKER_URL);
    return navigator.serviceWorker.ready;
};

// The key the browser wants: the server's public key as bytes
const keyBytes = (base64) => {
    const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

/**
 * Makes sure the server can push to this device: subscribes if it is not yet, and tells the server either way
 * (a subscription can change under the app, or belong to the account that was signed in here before).
 * @returns {Boolean} - whether push reaches this device; false where the server sends none
 */
export const syncPush = async () => {
    if (!canPush()) return false;

    const { publicKey } = await notificationService.getConfig();
    if (!publicKey) return false;

    const registration = await worker();
    const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(publicKey),
        }));

    await notificationService.subscribe(subscription.toJSON());
    return true;
};

/**
 * Turns reminders on for this device: asks the browser's permission, starts the service worker, and
 * subscribes to push where the server sends it.
 * @returns {Object} - { on, push, reason }: on, whether reminders will be shown here; push, whether they also
 *   come while the app is closed; reason, why not, when they will not
 */
export const turnOnHere = async () => {
    if (!canNotify()) return { on: false, push: false, reason: "unsupported" };

    const answer = await Notification.requestPermission();
    if (answer !== "granted") return { on: false, push: false, reason: answer };

    await worker();
    remember(DEVICE_SETTING, true);
    changed();

    let push = false;
    try {
        push = await syncPush();
    } catch {
        // Reminders still come while the app is open
    }
    return { on: true, push };
};

// Turns them off here: no more reminders on this device, from the app or the server
export const turnOffHere = async () => {
    forget(DEVICE_SETTING);
    changed();
    if (!canPush()) return;

    const registration = await navigator.serviceWorker.getRegistration(WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    await notificationService.unsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
};

/**
 * Signing out: the server stops pushing to this device for the account that is leaving. Reminders stay on
 * here, and the next account to sign in on this device takes the device over (syncPush).
 */
export const releaseDevice = async () => {
    if (!canPush()) return;

    const registration = await navigator.serviceWorker.getRegistration(WORKER_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) await notificationService.unsubscribe(subscription.endpoint);
};

/**
 * Shows a reminder on this device, unless it has been shown already (by the server's push, or before).
 * @param {Object} reminder - { key, title, body, url }
 */
export const showReminder = async ({ key, title, body, url }) => {
    if (permission() !== "granted") return;

    const cache = await caches.open(SHOWN);
    if (await cache.match(shownKey(key))) return;
    await cache.put(shownKey(key), new Response(String(Date.now())));

    const registration = await worker();
    await registration.showNotification(title, {
        body,
        tag: key,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        data: { url: url || "/today" },
    });
};

/**
 * A reminder to see how they look: pushed by the server where it can, so the whole way is tried,
 * and shown by the app itself where it cannot.
 */
export const sendTestReminder = async () => {
    try {
        await notificationService.test();
        return;
    } catch {
        // No push here: show one from the app instead
    }

    await showReminder({
        key: `test:${Date.now()}`,
        title: "Reminders are on",
        body: "This is how a reminder looks when something is about to start.",
        url: "/settings",
    });
};
