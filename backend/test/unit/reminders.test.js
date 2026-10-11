import "../helpers/env.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { moneyRemindersOn } from "../../src/utils/moneyReminders.js";
import { remindersAt } from "../../src/utils/reminders.js";

// Which reminders are due at a moment of the day, worked out from the day as readDay reads it

const TODAY = "2026-10-11";
const at = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
const item = (id, fields = {}) => ({ _id: id, isActive: true, ...fields });
const dayOf = ({ routines = [], habits = [], doneRoutines = [], doneHabits = [] } = {}) => ({
    routines,
    habits,
    doneRoutineIds: new Set(doneRoutines),
    doneHabitIds: new Set(doneHabits),
});

describe("reminders", () => {
    const study = item("r1", { title: "Study", startTime: "16:00" });

    it("reminds of a routine from its lead time until it starts", () => {
        const day = dayOf({ routines: [study] });
        const due = (time, lead = 10) => remindersAt({ today: TODAY, clock: at(time), day, lead, habits: false });

        assert.deepEqual(due("15:49"), []);
        assert.deepEqual(due("15:50"), [
            { key: `routine:r1:${TODAY}`, title: "Study", body: "Starts in 10 minutes.", url: "/today" },
        ]);
        assert.equal(due("15:59")[0].body, "Starts in 1 minute.");
        assert.deepEqual(due("16:00"), []);
        assert.equal(due("15:00", 60)[0].body, "Starts in 1 hour.");
    });

    it("reminds as it starts when there is no lead, for a few minutes only", () => {
        const day = dayOf({ routines: [study] });
        const due = (time) => remindersAt({ today: TODAY, clock: at(time), day, lead: 0, habits: false });

        assert.deepEqual(due("15:59"), []);
        assert.equal(due("16:00")[0].body, "Starting now.");
        assert.equal(due("16:04").length, 1);
        assert.deepEqual(due("16:05"), []);
    });

    it("reads a time written the older way", () => {
        const day = dayOf({ routines: [item("r2", { title: "Walk", startTime: "6:30 PM" })] });
        assert.equal(remindersAt({ today: TODAY, clock: at("18:25"), day, habits: false }).length, 1);
    });

    it("says nothing of a routine already done, or one that left the plan today", () => {
        const left = item("r3", { title: "Gone", startTime: "16:00", isActive: false });
        const day = dayOf({ routines: [study, left], doneRoutines: ["r1"] });

        assert.deepEqual(remindersAt({ today: TODAY, clock: at("15:55"), day, habits: false }), []);
    });

    it("nudges once for the habits of a part of the day that are still open", () => {
        const habits = [
            item("h1", { title: "Water", timeOfDay: "morning" }),
            item("h2", { title: "Stretch", timeOfDay: "morning" }),
            item("h3", { title: "Journal", timeOfDay: "morning" }),
            item("h4", { title: "Read", timeOfDay: "evening" }),
        ];
        const day = dayOf({ habits, doneHabits: ["h2"] });
        const due = (time, on = true) => remindersAt({ today: TODAY, clock: at(time), day, habits: on });

        assert.deepEqual(due("07:59"), []);
        assert.deepEqual(due("08:00"), [
            { key: `habits:morning:${TODAY}`, title: "This morning’s habits", body: "Water, Journal", url: "/today" },
        ]);
        assert.equal(due("08:59").length, 1);
        assert.deepEqual(due("09:00"), []);
        assert.equal(due("18:10")[0].body, "Read");
        assert.deepEqual(due("08:00", false), []);
    });

    it("reminds again before a routine ends, only when asked to and only while it is not done", () => {
        const study = item("r1", { title: "Study", startTime: "16:00", endTime: "20:00" });
        const due = (time, endLead, done = []) =>
            remindersAt({ today: TODAY, clock: at(time), day: dayOf({ routines: [study], doneRoutines: done }), endLead, habits: false });

        assert.deepEqual(due("19:50", null), []);
        assert.deepEqual(due("19:49", 10), []);
        assert.deepEqual(due("19:50", 10), [
            {
                key: `routine-end:r1:${TODAY}`,
                title: "Study",
                body: "Ends in 10 minutes, and it isn’t ticked off yet.",
                url: "/today",
            },
        ]);
        assert.equal(due("19:59", 10).length, 1);
        assert.deepEqual(due("20:00", 10), []);
        assert.deepEqual(due("19:55", 10, ["r1"]), []);
    });

    it("says nothing before the end of a routine too short for it", () => {
        const quick = item("r1", { title: "Stretch", startTime: "07:00", endTime: "07:10" });
        const day = dayOf({ routines: [quick] });

        assert.deepEqual(remindersAt({ today: TODAY, clock: at("06:55"), day, lead: 0, endLead: 15, habits: false }), []);
    });

    it("says nothing for a part of the day whose habits are all done", () => {
        const day = dayOf({ habits: [item("h1", { title: "Water", timeOfDay: "morning" })], doneHabits: ["h1"] });
        assert.deepEqual(remindersAt({ today: TODAY, clock: at("08:00"), day }), []);
    });
});

describe("money reminders", () => {
    const sub = (fields) => ({ _id: "s1", name: "Netflix", amount: 649, reminderDays: 3, ...fields });
    const on = (subscription) => moneyRemindersOn({ today: TODAY, subscriptions: [subscription] });

    it("reminds of a subscription as many days ahead as it asks, on its day, and once it is overdue", () => {
        assert.deepEqual(on(sub({ nextDueDate: "2026-10-15T00:00:00.000Z" })), []);
        assert.deepEqual(on(sub({ nextDueDate: "2026-10-14T00:00:00.000Z" })), [
            {
                key: "subscription:s1:2026-10-14:ahead",
                title: "Netflix is due in 3 days",
                body: "₹649, due Wed 14 Oct.",
                url: "/expenses",
            },
        ]);
        assert.equal(on(sub({ nextDueDate: "2026-10-12T00:00:00.000Z" }))[0].title, "Netflix is due tomorrow");
        assert.deepEqual(on(sub({ nextDueDate: "2026-10-11T00:00:00.000Z" }))[0].key, "subscription:s1:2026-10-11:today");
        assert.deepEqual(on(sub({ nextDueDate: "2026-10-09T00:00:00.000Z" }))[0].key, "subscription:s1:2026-10-09:overdue");
        assert.deepEqual(on(sub({ nextDueDate: "2026-10-01T00:00:00.000Z" })), []);
        // One that asks for no warning ahead hears only on its day
        assert.deepEqual(on(sub({ reminderDays: 0, nextDueDate: "2026-10-12T00:00:00.000Z" })), []);
    });

    it("warns once a spending limit passes its share, and again once it is over", () => {
        const budgets = [{ _id: "b1", category: "Food", monthlyLimit: 5000, alertThreshold: 0.8 }];
        const spending = (amount) =>
            moneyRemindersOn({ today: TODAY, budgets, spent: new Map([["Food", amount]]) });

        assert.deepEqual(spending(3999), []);
        assert.deepEqual(spending(4200), [
            {
                key: "budget:b1:2026-10:near",
                title: "Food is at 84% of its limit",
                body: "₹4,200 of ₹5,000 spent this month, ₹800 left.",
                url: "/expenses",
            },
        ]);
        assert.deepEqual(spending(5600)[0].key, "budget:b1:2026-10:over");
    });
});
