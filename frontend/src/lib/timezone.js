// The timezone an account lives in, put into words. The server decides which zone that is: every request
// reports this device's zone, and the account follows it, at most once in 24 hours (so a day that has
// ended cannot be reopened by changing zones). Nothing here changes it; this only explains it.

// How long the server waits between two changes of zone (TIMEZONE_CHANGE_COOLDOWN_MS on the server)
const CHANGE_EVERY_MS = 24 * 60 * 60 * 1000;

export const deviceZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
};

// "Asia/Kolkata" as it is said: "Asia/Kolkata", with the underscores of "America/New_York" as spaces
export const zoneName = (zone) => (zone ?? "").replaceAll("_", " ");

// How far the zone stands from Greenwich right now: "GMT+5:30". Empty for a zone this browser does not know.
export const zoneOffset = (zone, now = new Date()) => {
    try {
        const parts = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(now);
        return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    } catch {
        return "";
    }
};

const clockIn = (zone, now) =>
    now.toLocaleString("en-CA", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

// True when two zones show the same time right now, as two names for one place do
// ("Asia/Calcutta" and "Asia/Kolkata"). The server treats those as the same zone, and so does this.
export const sameClock = (zoneA, zoneB, now = new Date()) => {
    if (!zoneA || !zoneB) return false;
    if (zoneA === zoneB) return true;

    try {
        return clockIn(zoneA, now) === clockIn(zoneB, now);
    } catch {
        return false;
    }
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayTimeFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * What Settings says about the zone.
 * user: the account ({ timezone, timezoneUpdatedAt }). device: this device's zone. now: the moment.
 * Returns { zone: "Asia/Kolkata", offset: "GMT+5:30", note: a sentence or two }.
 */
export const timezoneWords = (user, device = deviceZone(), now = new Date()) => {
    const zone = user?.timezone || "UTC";
    const base = { zone: zoneName(zone), offset: zoneOffset(zone, now) };
    const follows = "Your day ends at midnight in this zone. It is set from this device’s clock.";

    if (!device || sameClock(zone, device, now)) {
        return { ...base, note: follows };
    }

    // This device is somewhere else. The account will follow it once a day has passed since its last move.
    const elsewhere = `This device is on ${zoneName(device)} time.`;
    const changedAt = user?.timezoneUpdatedAt ? new Date(user.timezoneUpdatedAt) : null;
    const freeAt = changedAt && !Number.isNaN(changedAt.getTime()) ? new Date(changedAt.getTime() + CHANGE_EVERY_MS) : null;

    if (!freeAt || freeAt <= now) {
        return { ...base, note: `${elsewhere} Your account will move to it the next time the app loads.` };
    }

    const when = sameDay(freeAt, now) ? `${timeFormat.format(freeAt)} today` : dayTimeFormat.format(freeAt);
    return {
        ...base,
        note: `${elsewhere} An account changes zone at most once a day, so yours stays here until ${when}, and your day still ends at midnight here.`,
    };
};
