import "../helpers/env.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { countsOn, missCost } from "../../src/utils/dayPlan.js";
import { DEFAULT_TRASH_DAYS, trashStamp } from "../../src/utils/trash.js";

const TZ = "Asia/Kolkata";
// Kolkata is five and a half hours ahead of UTC: 20:00Z on the 9th is 01:30 on the 10th there
const at = (iso) => new Date(iso);

describe("whether an item counts on a day", () => {
    const made = at("2026-03-01T06:00:00Z");

    it("counts from the day it was made, while it is in the plan", () => {
        const item = { isActive: true, createdAt: made };

        assert.equal(countsOn(item, "2026-02-28", TZ), false);
        assert.equal(countsOn(item, "2026-03-01", TZ), true);
        assert.equal(countsOn(item, "2026-03-09", TZ), true);
    });

    it("still counts on the day it was deleted, and on no day after", () => {
        const item = { isActive: false, createdAt: made, deletedAt: at("2026-03-09T10:00:00Z") };

        assert.equal(countsOn(item, "2026-03-09", TZ), true);
        assert.equal(countsOn(item, "2026-03-10", TZ), false);
        assert.equal(countsOn(item, "2026-03-08", TZ), false);
    });

    it("reads the day of the delete in the owner's timezone", () => {
        const item = { isActive: false, createdAt: made, deletedAt: at("2026-03-09T20:00:00Z") };

        assert.equal(countsOn(item, "2026-03-10", TZ), true);
        assert.equal(countsOn(item, "2026-03-09", TZ), false);
        assert.equal(countsOn(item, "2026-03-09", "UTC"), true);
    });

    it("lets go of something made and deleted on the same day", () => {
        const item = { isActive: false, createdAt: at("2026-03-09T04:00:00Z"), deletedAt: at("2026-03-09T10:00:00Z") };

        assert.equal(countsOn(item, "2026-03-09", TZ), false);
    });

    it("never counts something deleted before Trash kept the date", () => {
        assert.equal(countsOn({ isActive: false, createdAt: made }, "2026-03-09", TZ), false);
        assert.equal(countsOn({ isActive: false, createdAt: made, deletedAt: null }, "2026-03-09", TZ), false);
    });
});

describe("what leaving something undone costs", () => {
    it("is half of a routine and a third of a habit, rounded down", () => {
        assert.equal(missCost("routine", { xpReward: 10 }), 5);
        assert.equal(missCost("habit", { xpReward: 10 }), 3);
        assert.equal(missCost("habit", { xpReward: 25 }), 8);
        assert.equal(missCost("routine", {}), 0);
    });
});

describe("the dates a thing gets as it goes into Trash", () => {
    const now = at("2026-03-09T10:00:00Z");
    const DAY = 24 * 60 * 60 * 1000;

    it("keeps it for as long as its owner chose", () => {
        for (const days of [1, 3, 7]) {
            const stamp = trashStamp({ trashDays: days }, now);
            assert.equal(stamp.deletedAt.getTime(), now.getTime());
            assert.equal(stamp.purgeAt.getTime() - now.getTime(), days * DAY);
        }
    });

    it("falls back to a week for an account that never chose", () => {
        assert.equal(DEFAULT_TRASH_DAYS, 7);
        assert.equal(trashStamp({}, now).purgeAt.getTime() - now.getTime(), 7 * DAY);
        assert.equal(trashStamp(undefined, now).purgeAt.getTime() - now.getTime(), 7 * DAY);
    });
});
