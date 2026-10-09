import { describe, it } from "node:test";
import assert from "node:assert/strict";

import "../helpers/env.js";
import {
    itemsOfDay,
    lossByDay,
    runEndedBy,
    runEndingOn,
    unnamedMisses,
} from "../../src/utils/dayHistory.js";

const RUN = "aaaaaaaaaaaaaaaaaaaaaaaa";
const READ = "bbbbbbbbbbbbbbbbbbbbbbbb";
const WATER = "cccccccccccccccccccccccc";
const GONE = "dddddddddddddddddddddddd";

const routines = new Map([
    [RUN, { title: "Morning run", startTime: "06:30", endTime: "07:00", isActive: true }],
    [READ, { title: "Read", startTime: "21:00", endTime: "", isActive: true }],
]);
const habits = new Map([
    [WATER, { title: "Water", habitType: "quantity", targetQuantity: 8, unit: "glasses", timeOfDay: "anytime", xpReward: 15, isActive: true }],
]);
const missed = (reason, field, id, amount, date = "2026-03-09") => ({ reason, amount, metadata: { [field]: id, date } });

describe("one ended day, item by item", () => {
    const build = (parts) =>
        itemsOfDay({ routineLogs: [], habitLogs: [], penalties: [], routines, habits, ...parts });

    it("takes what was done from the logs, and tells late from on time", () => {
        const items = build({
            routineLogs: [
                { routine: RUN, completedAt: "06:50", wasOnTime: true, xpEarned: 10 },
                { routine: READ, completedAt: "23:40", wasOnTime: false, xpEarned: 5 },
            ],
        });

        assert.deepEqual(items.map((item) => [item.title, item.status, item.xpEarned]), [
            ["Morning run", "done", 10],
            ["Read", "late", 5],
        ]);
    });

    it("takes what was missed from the ledger", () => {
        const [item] = build({ penalties: [missed("routine_missed", "routineId", READ, -5)] });

        assert.equal(item.status, "missed");
        assert.equal(item.xpLost, 5);
        assert.equal(item.startTime, "21:00");
    });

    it("keeps a count that fell short as part done, with what it cost", () => {
        const [item] = build({
            habitLogs: [{ habit: WATER, completed: false, quantity: 3 }],
            penalties: [missed("habit_missed", "habitId", WATER, -5)],
        });

        assert.equal(item.status, "partial");
        assert.equal(item.quantity, 3);
        assert.equal(item.target, 8);
        assert.equal(item.xpLost, 5);
        assert.equal(item.xpEarned, undefined);
    });

    it("passes over a log that holds nothing", () => {
        assert.deepEqual(build({ habitLogs: [{ habit: WATER, completed: false, quantity: 0 }] }), []);
    });

    it("pays an old completion, kept without its amount, what the habit is worth", () => {
        const [item] = build({ habitLogs: [{ habit: WATER, completed: true, quantity: 8 }] });

        assert.equal(item.xpEarned, 15);
    });

    it("lists something it can no longer name, without a name", () => {
        const [item] = build({ routineLogs: [{ routine: GONE, completedAt: "08:00", wasOnTime: true, xpEarned: 10 }] });

        assert.equal(item.title, null);
        assert.equal(item.active, false);
        assert.equal(item.status, "done");
    });
});

describe("what a day lost", () => {
    it("adds up the penalties of each day", () => {
        const lost = lossByDay([
            missed("routine_missed", "routineId", RUN, -5, "2026-03-08"),
            missed("habit_missed", "habitId", WATER, -5, "2026-03-09"),
            missed("routine_missed", "routineId", READ, -10, "2026-03-09"),
        ]);

        assert.deepEqual([...lost], [["2026-03-08", 5], ["2026-03-09", 15]]);
    });

    it("counts the misses the ledger could not name", () => {
        const summary = { totalRoutines: 3, completedRoutines: 1, totalHabits: 2, completedHabits: 1 };

        assert.equal(unnamedMisses(summary, []), 3);
        assert.equal(unnamedMisses(summary, [{ status: "missed" }, { status: "partial" }, { status: "done" }]), 1);
        assert.equal(unnamedMisses(summary, Array.from({ length: 5 }, () => ({ status: "missed" }))), 0);
        assert.equal(unnamedMisses(null, []), 0);
    });
});

describe("a run of days with everything done", () => {
    const perfect = new Set(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-03"]);
    const days = { perfect, rest: new Set() };

    it("is counted back from a day, across the end of a month", () => {
        assert.equal(runEndingOn(days, "2026-03-01"), 3);
        assert.equal(runEndingOn(days, "2026-03-03"), 1);
    });

    it("is nothing on a day that was not one of them", () => {
        assert.equal(runEndingOn(days, "2026-03-02"), 0);
    });

    it("steps over a day with nothing due, which neither adds to it nor ends it", () => {
        const withRest = { perfect, rest: new Set(["2026-03-02", "2026-02-26", "2026-02-25"]) };

        assert.equal(runEndingOn(withRest, "2026-03-03"), 4);
        // Counted from the rest day itself, the run behind it still stands
        assert.equal(runEndingOn(withRest, "2026-03-02"), 3);
        // Rest days with nothing before them do not go on for ever
        assert.equal(runEndingOn(withRest, "2026-02-26"), 0);
    });

    it("is ended by a day with something left undone, and by no other", () => {
        assert.equal(runEndedBy(days, { date: "2026-03-02", isPerfectDay: false, isRestDay: false }), 3);
        assert.equal(runEndedBy(days, { date: "2026-03-02", isPerfectDay: false, isRestDay: true }), 0);
        assert.equal(runEndedBy(days, { date: "2026-03-03", isPerfectDay: true, isRestDay: false }), 0);
    });
});
