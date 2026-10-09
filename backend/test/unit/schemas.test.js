import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { idParam } from "../../src/Schema/CommonSchema.js";
import {
    createHabitSchema,
    logHabitSchema,
    setHabitLogSchema,
    updateHabitSchema,
} from "../../src/Schema/HabitSchema.js";
import {
    completeRoutineSchema,
    createRoutineSchema,
    updateRoutineSchema,
} from "../../src/Schema/RoutineSchema.js";
import {
    dayParam,
    dayRangeQuerySchema,
    ledgerQuerySchema,
} from "../../src/Schema/HistorySchema.js";
import {
    createTransactionSchema,
    monthQuerySchema,
    updateSubscriptionSchema,
} from "../../src/Schema/ExpenseSchema.js";

// The same options the validation middleware uses
const validate = (schema, value) =>
    schema.validate(value, { abortEarly: false, stripUnknown: true });

const accepted = (schema, value) => {
    const { error, value: clean } = validate(schema, value);
    assert.equal(error, undefined, error?.message);
    return clean;
};

const rejected = (schema, value) => {
    const { error } = validate(schema, value);
    assert.ok(error, `expected ${JSON.stringify(value)} to be rejected`);
    return error.details.map((detail) => detail.message).join(", ");
};

describe("request schemas", () => {
    describe("habits", () => {
        it("accepts what the habit form sends", () => {
            const clean = accepted(createHabitSchema, {
                title: "  Read  ",
                description: "",
                category: "learning",
                difficulty: "easy",
                habitType: "quantity",
                targetQuantity: 20,
                unit: "pages",
                frequency: "daily",
                targetDays: [],
            });
            assert.equal(clean.title, "Read");
        });

        it("drops fields only the server may set", () => {
            const clean = accepted(updateHabitSchema, {
                difficulty: "hard",
                xpReward: 9999,
                bestStreak: 500,
                user: "000000000000000000000001",
                isActive: false,
            });
            assert.deepEqual(clean, { difficulty: "hard" });
        });

        it("refuses an update made only of protected fields", () => {
            assert.match(rejected(updateHabitSchema, { xpReward: 9999 }), /No valid fields/);
        });

        it("refuses query operators, impossible dates and negative amounts in a log", () => {
            rejected(logHabitSchema, { date: { $ne: "x" } });
            rejected(logHabitSchema, { date: "2026-02-31" });
            rejected(logHabitSchema, { date: "08-10-2026" });
            rejected(logHabitSchema, { quantity: -5 });
            assert.equal(accepted(logHabitSchema, { quantity: "2.5" }).quantity, 2.5);
        });

        it("takes the part of the day a habit sits in, from the four there are", () => {
            assert.equal(accepted(createHabitSchema, { title: "Read", timeOfDay: "evening" }).timeOfDay, "evening");
            assert.deepEqual(accepted(updateHabitSchema, { timeOfDay: "anytime" }), { timeOfDay: "anytime" });
            rejected(createHabitSchema, { title: "Read", timeOfDay: "night" });
            rejected(updateHabitSchema, { timeOfDay: "" });
        });

        it("sets today's count to zero or more, and nothing else", () => {
            assert.deepEqual(accepted(setHabitLogSchema, { quantity: 0 }), { quantity: 0 });
            assert.deepEqual(accepted(setHabitLogSchema, { quantity: 7.5, xpEarned: 500, completed: true }), { quantity: 7.5 });
            rejected(setHabitLogSchema, {});
            rejected(setHabitLogSchema, { quantity: -1 });
            rejected(setHabitLogSchema, { quantity: { $gt: 0 } });
            rejected(setHabitLogSchema, { quantity: 1000001 });
        });
    });

    describe("routines", () => {
        it("accepts what the routine form sends", () => {
            accepted(createRoutineSchema, {
                title: "Gym",
                description: "",
                startTime: "06:00",
                endTime: "",
                category: "fitness",
                isRecurring: true,
                recurringDays: [1, 3, 5],
                date: "2026-10-08",
            });
        });

        it("never lets the client choose the XP reward or the owner", () => {
            const clean = accepted(createRoutineSchema, {
                title: "Greedy",
                startTime: "09:00",
                xpReward: 5000,
                user: "000000000000000000000001",
            });
            assert.deepEqual(clean, { title: "Greedy", startTime: "09:00" });
            assert.match(rejected(updateRoutineSchema, { xpReward: 5000 }), /No valid fields/);
        });

        it("refuses nonsense times and weekdays", () => {
            rejected(createRoutineSchema, { title: "x", startTime: "25:99" });
            rejected(createRoutineSchema, { title: "x", startTime: "09:00", recurringDays: [7] });
        });

        it("does not take the completion time from the client", () => {
            const clean = accepted(completeRoutineSchema, {
                date: "2026-10-08",
                completedAt: "00:01",
            });
            assert.deepEqual(clean, { date: "2026-10-08" });
        });
    });

    describe("expenses", () => {
        const account = "0123456789abcdef01234567";

        it("accepts what the expense form sends", () => {
            const clean = accepted(createTransactionSchema, {
                type: "expense",
                amount: 250,
                category: "Food & Dining",
                description: "",
                paymentMethod: "upi",
                accountId: account,
                transferToAccountId: null,
                placeName: "",
                transactionDate: "2026-10-08",
                notes: "",
            });
            assert.ok(clean.transactionDate instanceof Date);
        });

        it("refuses zero or negative amounts and malformed ids", () => {
            rejected(createTransactionSchema, { amount: 0, accountId: account });
            rejected(createTransactionSchema, { amount: -1, accountId: account });
            rejected(createTransactionSchema, { amount: 5, accountId: "not-an-id" });
        });

        it("does not let a subscription change owner", () => {
            assert.match(
                rejected(updateSubscriptionSchema, { user: "000000000000000000000001" }),
                /No valid fields/,
            );
        });

        it("refuses a malformed month", () => {
            accepted(monthQuerySchema, { month: "2026-08" });
            accepted(monthQuerySchema, {});
            rejected(monthQuerySchema, { month: "2026-13" });
            rejected(monthQuerySchema, { month: "2026-8" });
            rejected(monthQuerySchema, { month: "last month" });
        });
    });

    describe("history", () => {
        it("takes a stretch of days of up to a year, in order", () => {
            accepted(dayRangeQuerySchema, { from: "2026-03-01", to: "2026-03-01" });
            accepted(dayRangeQuerySchema, { from: "2025-03-02", to: "2026-03-02" });

            assert.match(rejected(dayRangeQuerySchema, { from: "2025-03-01", to: "2026-03-02" }), /At most 366 days/);
            assert.match(rejected(dayRangeQuerySchema, { from: "2026-03-02", to: "2026-03-01" }), /must not be before/);
            rejected(dayRangeQuerySchema, { from: "2026-03-01" });
            rejected(dayRangeQuerySchema, { from: "2026-02-30", to: "2026-03-01" });
            rejected(dayRangeQuerySchema, { from: { $gt: "" }, to: "2026-03-01" });
        });

        it("takes one real day in the URL", () => {
            accepted(dayParam, { date: "2026-03-01" });
            rejected(dayParam, { date: "2026-3-1" });
            rejected(dayParam, { date: "2026-13-01" });
        });

        it("takes a page size and a place in the ledger, and nothing shaped otherwise", () => {
            accepted(ledgerQuerySchema, {});
            accepted(ledgerQuerySchema, { limit: "30", before: "1760000000000_0123456789abcdef01234567" });

            rejected(ledgerQuerySchema, { limit: 0 });
            rejected(ledgerQuerySchema, { limit: 101 });
            rejected(ledgerQuerySchema, { before: "1760000000000" });
            rejected(ledgerQuerySchema, { before: { $gt: "" } });
        });
    });

    it("refuses malformed ids in the URL with one clear message", () => {
        assert.equal(rejected(idParam, { id: "not-an-id" }), '"id" is not a valid id.');
    });
});
