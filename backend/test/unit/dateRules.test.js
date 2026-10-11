import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { endPausesFrom } from "../../src/utils/itemPause.js";
import {
    addDays,
    existedOn,
    getTodayIn,
    getUserClockTime,
    getUserToday,
    getWeekday,
    isHabitScheduledOn,
    isPausedOn,
    isRoutineScheduledOn,
    isValidTimezone,
    showSameTime,
} from "../../src/utils/dateRules.js";

describe("date rules", () => {
    it("finds today's date in the user's timezone, not the server's", () => {
        const evening = new Date("2026-10-08T19:00:00Z");
        assert.equal(getTodayIn("Asia/Kolkata", evening), "2026-10-09");
        assert.equal(getTodayIn("UTC", evening), "2026-10-08");

        const earlyMorning = new Date("2026-10-08T03:00:00Z");
        assert.equal(getTodayIn("America/Los_Angeles", earlyMorning), "2026-10-07");
    });

    it("finds midnight correctly on both sides of a daylight-saving change", () => {
        // New York moves from UTC-5 to UTC-4 on 2026-03-08
        assert.equal(getTodayIn("America/New_York", new Date("2026-03-08T04:30:00Z")), "2026-03-07");
        assert.equal(getTodayIn("America/New_York", new Date("2026-03-08T05:30:00Z")), "2026-03-08");
        assert.equal(getTodayIn("America/New_York", new Date("2026-03-09T03:30:00Z")), "2026-03-08");
        assert.equal(getTodayIn("America/New_York", new Date("2026-03-09T04:30:00Z")), "2026-03-09");
    });

    it("falls back to UTC for a user with no timezone", () => {
        const moment = new Date("2026-10-08T19:07:00Z");
        assert.equal(getUserToday({}, moment), "2026-10-08");
        assert.equal(getUserClockTime({}, moment), "19:07");
        assert.equal(getUserClockTime({ timezone: "Asia/Kolkata" }, moment), "00:37");
    });

    it("does calendar arithmetic across month ends, leap years and new year", () => {
        assert.equal(addDays("2026-03-01", -1), "2026-02-28");
        assert.equal(addDays("2024-03-01", -1), "2024-02-29");
        assert.equal(addDays("2026-12-31", 1), "2027-01-01");
        assert.equal(addDays("2026-10-08", -7), "2026-10-01");
    });

    it("reads the weekday from the date itself", () => {
        assert.equal(getWeekday("2026-10-08"), 4); // Thursday
        assert.equal(getWeekday("2026-10-11"), 0); // Sunday
    });

    it("accepts only real timezone names", () => {
        assert.ok(isValidTimezone("Asia/Kolkata"));
        assert.ok(isValidTimezone("UTC"));
        assert.ok(!isValidTimezone("Mars/Olympus"));
        assert.ok(!isValidTimezone(""));
        assert.ok(!isValidTimezone(42));
        assert.ok(!isValidTimezone("A".repeat(80)));
    });

    it("recognises two names for the same zone", () => {
        const moment = new Date("2026-10-08T19:00:00Z");
        assert.ok(showSameTime("Asia/Calcutta", "Asia/Kolkata", moment));
        assert.ok(showSameTime("UTC", "Etc/GMT", moment));
        assert.ok(!showSameTime("Asia/Kolkata", "Europe/London", moment));
    });

    it("knows which days a routine is due", () => {
        const weekdays = { isRecurring: true, recurringDays: [1, 3, 5] };
        assert.ok(!isRoutineScheduledOn(weekdays, "2026-10-08")); // Thursday
        assert.ok(isRoutineScheduledOn(weekdays, "2026-10-09")); // Friday

        const oneTime = { isRecurring: false, recurringDays: [], date: "2026-10-08" };
        assert.ok(isRoutineScheduledOn(oneTime, "2026-10-08"));
        assert.ok(!isRoutineScheduledOn(oneTime, "2026-10-09"));
    });

    it("knows which days a habit is due", () => {
        assert.ok(isHabitScheduledOn({ frequency: "daily", targetDays: [] }, "2026-10-08"));
        assert.ok(isHabitScheduledOn({ frequency: "weekly", targetDays: [] }, "2026-10-08"));
        assert.ok(isHabitScheduledOn({ frequency: "weekly", targetDays: [4] }, "2026-10-08"));
        assert.ok(!isHabitScheduledOn({ frequency: "weekly", targetDays: [1, 2] }, "2026-10-08"));
    });

    it("takes a paused item off the days its pauses cover, both ends included", () => {
        const pauses = [{ from: "2026-10-08", until: "2026-10-10" }];
        const routine = { isRecurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6], pauses };
        const habit = { frequency: "daily", targetDays: [], pauses };

        assert.ok(isPausedOn(routine, "2026-10-08"));
        assert.ok(isPausedOn(routine, "2026-10-10"));
        assert.ok(!isPausedOn(routine, "2026-10-11"));
        assert.ok(!isPausedOn({}, "2026-10-08"));

        assert.ok(isRoutineScheduledOn(routine, "2026-10-07"));
        assert.ok(!isRoutineScheduledOn(routine, "2026-10-09"));
        assert.ok(isRoutineScheduledOn(routine, "2026-10-11"));
        assert.ok(!isHabitScheduledOn(habit, "2026-10-09"));
        assert.ok(isHabitScheduledOn(habit, "2026-10-11"));
    });

    it("ends pauses at a day: what ran past it stops the day before, what had not started is dropped", () => {
        const pauses = [
            { from: "2026-09-01", until: "2026-09-03" },
            { from: "2026-10-05", until: "2026-10-12" },
            { from: "2026-10-20", until: "2026-10-22" },
        ];

        assert.deepEqual(endPausesFrom(pauses, "2026-10-09"), [
            { from: "2026-09-01", until: "2026-09-03" },
            { from: "2026-10-05", until: "2026-10-08" },
        ]);
        assert.deepEqual(endPausesFrom(pauses, "2026-10-05"), [{ from: "2026-09-01", until: "2026-09-03" }]);
        assert.deepEqual(endPausesFrom(undefined, "2026-10-05"), []);
    });

    it("treats an item as existing from the day it was created, in the user's timezone", () => {
        // 20:00 UTC on the 8th is already the 9th in India
        const item = { createdAt: new Date("2026-10-08T20:00:00Z") };
        assert.ok(!existedOn(item, "2026-10-08", "Asia/Kolkata"));
        assert.ok(existedOn(item, "2026-10-09", "Asia/Kolkata"));
        assert.ok(existedOn(item, "2026-10-08", "UTC"));
    });
});
