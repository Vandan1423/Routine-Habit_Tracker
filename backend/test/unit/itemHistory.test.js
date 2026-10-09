import { describe, it } from "node:test";
import assert from "node:assert/strict";

import "../helpers/env.js";
import { runsOf } from "../../src/utils/itemHistory.js";

describe("runs of days", () => {
    const run = (done, { due = () => true, firstDay = "2026-03-01", today = "2026-03-10" } = {}) =>
        runsOf({ doneDates: new Set(done), isDueOn: due, firstDay, today });

    it("is nothing for something never done", () => {
        assert.deepEqual(run([]), { current: 0, best: 0 });
    });

    it("stands while today is still open, and grows once today is done", () => {
        assert.deepEqual(run(["2026-03-08", "2026-03-09"]), { current: 2, best: 2 });
        assert.deepEqual(run(["2026-03-08", "2026-03-09", "2026-03-10"]), { current: 3, best: 3 });
    });

    it("ends on a day that was due and not done", () => {
        assert.deepEqual(
            run(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-09"]),
            { current: 1, best: 3 },
        );
        assert.deepEqual(run(["2026-03-02", "2026-03-03"]), { current: 0, best: 2 });
    });

    it("passes over days that were not due", () => {
        // Due on even days only
        const due = (date) => Number(date.slice(-2)) % 2 === 0;
        assert.deepEqual(run(["2026-03-04", "2026-03-06", "2026-03-08"], { due }), { current: 3, best: 3 });
    });

    it("counts what was done before the day it says it was made", () => {
        assert.deepEqual(
            run(["2026-03-08", "2026-03-09"], { firstDay: "2026-03-09" }),
            { current: 2, best: 2 },
        );
    });
});
