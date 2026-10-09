// Days of the week. The API numbers them 0 for Sunday to 6 for Saturday, and so does every value in the app.

// 0 to 6: the day the reader's own locale starts its week on (Monday where that is not known)
export const firstDayOfWeek = () => {
    try {
        const locale = new Intl.Locale(new Intl.DateTimeFormat().resolvedOptions().locale);
        const week = locale.getWeekInfo?.() ?? locale.weekInfo;
        // Intl counts Monday as 1 up to Sunday as 7
        return week ? week.firstDay % 7 : 1;
    } catch {
        return 1;
    }
};

// The seven day numbers in the order a week is read, such as [1, 2, 3, 4, 5, 6, 0]
export const weekOrder = (firstDay = firstDayOfWeek()) =>
    Array.from({ length: 7 }, (_, index) => (firstDay + index) % 7);

// The names are in English, the language the interface is written in
const names = {
    long: new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }),
    short: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }),
};

// "Monday" or "Mon" for day 1. (2 January 2000 was a Sunday.)
export const weekdayName = (day, width = "long") =>
    names[width].format(new Date(Date.UTC(2000, 0, 2 + day)));
