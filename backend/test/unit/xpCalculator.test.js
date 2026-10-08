import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { calculateLevel, getXpForLevel } from "../../src/utils/xpCalculator.js";

describe("XP and levels", () => {
    it("needs 100 XP more for each level", () => {
        assert.equal(getXpForLevel(1), 100);
        assert.equal(getXpForLevel(5), 500);
    });

    it("starts at level 1 with nothing", () => {
        assert.deepEqual(calculateLevel(0), {
            level: 1,
            currentXp: 0,
            xpForNext: 100,
            totalXp: 0,
            progressPercentage: 0,
        });
        assert.equal(calculateLevel(undefined).level, 1);
    });

    it("levels up exactly at the threshold", () => {
        assert.equal(calculateLevel(99).level, 1);
        assert.equal(calculateLevel(100).level, 2);
        assert.equal(calculateLevel(299).level, 2);
        assert.equal(calculateLevel(300).level, 3);
    });

    it("reports progress towards the next level", () => {
        const info = calculateLevel(150); // level 2, 50 of 200
        assert.equal(info.level, 2);
        assert.equal(info.currentXp, 50);
        assert.equal(info.xpForNext, 200);
        assert.equal(info.progressPercentage, 25);
    });
});
