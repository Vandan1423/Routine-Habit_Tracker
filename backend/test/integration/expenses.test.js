import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    createClient,
    skipWithoutDatabase,
    startApp,
    stopApp,
    todayIn,
} from "../helpers/app.js";

// What the Expenses screen is told about one month: the month today is in unless another is asked for.

const TZ = "Asia/Kolkata";

// shiftMonth("2026-01", -1) is "2025-12", worked out without the app's own helper
const shiftMonth = (month, offset) => {
    const [year, number] = month.split("-").map(Number);
    const total = year * 12 + (number - 1) + offset;

    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

describe("expenses, month by month", { skip: skipWithoutDatabase }, () => {
    const today = todayIn(TZ);
    const thisMonth = today.slice(0, 7);
    const lastMonth = shiftMonth(thisMonth, -1);
    const earlier = shiftMonth(thisMonth, -3);

    before(startApp);
    after(stopApp);

    // A signed-in account with its two accounts, and a way to log to the first of them
    const setup = async () => {
        const client = createClient({ timezone: TZ });
        await client.register();
        const { accounts } = (await client.get("/expenses/summary")).body;

        const log = async (fields) => {
            const response = await client.post("/expenses/transactions", {
                type: "expense",
                accountId: accounts[0]._id,
                ...fields,
            });
            assert.equal(response.status, 201, response.text);
            return response.body.transaction;
        };

        return { client, accounts, log, get: async (path) => (await client.get(path)).body };
    };

    describe("the summary", () => {
        it("is for the month today is in when no month is asked for", async () => {
            const { log, get } = await setup();
            await log({ amount: 300, category: "Travel", placeName: "Metro", transactionDate: `${thisMonth}-01` });
            await log({ amount: 120, category: "Food & Dining", placeName: "Canteen", transactionDate: `${thisMonth}-01` });
            await log({ type: "income", amount: 5000, transactionDate: `${thisMonth}-01` });
            await log({ amount: 900, category: "Shopping", transactionDate: `${lastMonth}-01` });

            const summary = await get("/expenses/summary");

            assert.equal(summary.today, today);
            assert.equal(summary.month, thisMonth);
            assert.equal(summary.currentMonthKey, thisMonth);
            assert.equal(summary.monthExpensesTotal, 420);
            assert.equal(summary.monthExpenseCount, 2);
            assert.equal(summary.monthIncomeTotal, 5000);
            assert.equal(summary.previousMonthExpensesTotal, 900);
            assert.equal(summary.firstMonth, lastMonth);
            assert.equal(summary.lastMonth, thisMonth);
            assert.deepEqual(summary.categoryTotals, [
                { category: "Travel", total: 300 },
                { category: "Food & Dining", total: 120 },
            ]);
            assert.deepEqual(
                summary.monthPlaceTotals.map((place) => [place.name, place.total, place.count]),
                [["Metro", 300, 1], ["Canteen", 120, 1]],
            );
            assert.equal(summary.monthSeries.length, 6);
            assert.equal(summary.monthSeries.at(-1).monthKey, thisMonth);
            assert.equal(summary.monthSeries.at(-1).total, 420);
            assert.equal(summary.monthSeries.at(-2).total, 900);

            // What it has always said still stands
            assert.equal(summary.currentMonthExpensesTotal, 420);
            assert.equal(summary.lastMonthExpensesTotal, 900);
            assert.equal(summary.recentTransactions.length, 4);
            assert.equal(summary.accounts[0].currentBalance, 5000 - 420 - 900);
        });

        it("is for another month when one is asked for", async () => {
            const { log, get } = await setup();
            await log({ amount: 300, category: "Travel", transactionDate: `${thisMonth}-01` });
            await log({ amount: 640, category: "Gifts", placeName: "Bookshop", transactionDate: `${earlier}-12` });
            await log({ amount: 60, category: "Gifts", placeName: "Bookshop", transactionDate: `${earlier}-20` });
            await log({ amount: 75, category: "Travel", transactionDate: `${shiftMonth(earlier, -1)}-03` });

            const summary = await get(`/expenses/summary?month=${earlier}`);

            assert.equal(summary.month, earlier);
            assert.equal(summary.currentMonthKey, thisMonth);
            assert.equal(summary.monthExpensesTotal, 700);
            assert.equal(summary.monthExpenseCount, 2);
            assert.equal(summary.previousMonthExpensesTotal, 75);
            // Said only of the month that is still running
            assert.equal(summary.previousMonthToDate, null);
            assert.deepEqual(summary.categoryTotals, [{ category: "Gifts", total: 700 }]);
            assert.deepEqual(summary.monthPlaceTotals, [{ name: "Bookshop", total: 700, count: 2 }]);
            assert.equal(summary.monthSeries.at(-1).monthKey, earlier);
            assert.equal(summary.monthSeries.at(-1).total, 700);
            assert.equal(summary.monthSeries.at(-2).total, 75);
            assert.equal(summary.firstMonth, shiftMonth(earlier, -1));
            assert.equal(summary.lastMonth, thisMonth);

            // The running month's own figures and the balances do not follow the month on show
            assert.equal(summary.currentMonthExpensesTotal, 300);
            assert.equal(summary.accounts[0].currentBalance, -(300 + 640 + 60 + 75));
        });

        it("says what had been spent by this day of the month before", async () => {
            const { log, get } = await setup();
            await log({ amount: 200, transactionDate: `${lastMonth}-01` });
            await log({ amount: 50, transactionDate: `${lastMonth}-28` });

            const summary = await get("/expenses/summary");
            const dayOfMonth = Number(today.slice(8));

            assert.equal(summary.previousMonthExpensesTotal, 250);
            assert.equal(summary.previousMonthToDate, dayOfMonth >= 28 ? 250 : 200);
        });

        it("has nothing to say for an account that has logged nothing", async () => {
            const { get } = await setup();
            const summary = await get("/expenses/summary");

            assert.equal(summary.firstMonth, null);
            assert.equal(summary.lastMonth, null);
            assert.equal(summary.monthExpensesTotal, 0);
            assert.equal(summary.previousMonthToDate, 0);
            assert.deepEqual(summary.categoryTotals, []);
            assert.deepEqual(summary.monthPlaceTotals, []);
            assert.equal(summary.accounts.length, 2);
        });

        it("never counts another account's money", async () => {
            const mine = await setup();
            const theirs = await setup();
            await theirs.log({ amount: 999, transactionDate: `${thisMonth}-01` });

            const summary = await mine.get(`/expenses/summary?month=${thisMonth}`);
            assert.equal(summary.monthExpensesTotal, 0);
            assert.equal(summary.firstMonth, null);
            assert.deepEqual((await mine.get(`/expenses/transactions?month=${thisMonth}`)).transactions, []);
        });
    });

    describe("the list of transactions", () => {
        it("holds one month when a month is asked for, newest first", async () => {
            const { log, get } = await setup();
            const first = await log({ amount: 10, description: "first", transactionDate: `${earlier}-05` });
            const second = await log({ amount: 20, description: "second", transactionDate: `${earlier}-19` });
            const sameDay = await log({ amount: 30, description: "same day, logged later", transactionDate: `${earlier}-19` });
            await log({ amount: 40, description: "another month", transactionDate: `${thisMonth}-01` });

            const { transactions } = await get(`/expenses/transactions?month=${earlier}`);
            assert.deepEqual(
                transactions.map((transaction) => transaction._id),
                [sameDay._id, second._id, first._id],
            );
            assert.equal(transactions[0].account.name, "Bank");

            assert.equal((await get("/expenses/transactions")).transactions.length, 4);
            assert.deepEqual((await get(`/expenses/transactions?month=${shiftMonth(earlier, 1)}`)).transactions, []);
        });
    });

    it("refuses a month that is not one", async () => {
        const { client } = await setup();

        for (const path of ["/expenses/summary", "/expenses/transactions", "/expenses/export"]) {
            const response = await client.get(`${path}?month=2026-13`);
            assert.equal(response.status, 400, path);
            assert.match(response.body.message, /YYYY-MM/);
        }
    });
});
