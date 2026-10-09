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

        it("says what each day of the month spent, newest first", async () => {
            const { log, get } = await setup();
            await log({ amount: 40, transactionDate: `${earlier}-05` });
            await log({ amount: 25, transactionDate: `${earlier}-19` });
            await log({ amount: 35, transactionDate: `${earlier}-19` });
            await log({ type: "income", amount: 900, transactionDate: `${earlier}-19` });
            await log({ amount: 500, transactionDate: `${thisMonth}-01` });

            const summary = await get(`/expenses/summary?month=${earlier}`);
            assert.deepEqual(summary.monthDays, [
                { date: `${earlier}-19`, spent: 60 },
                { date: `${earlier}-05`, spent: 40 },
            ]);
        });

        it("works out what each account holds, a transfer and a deleted line included", async () => {
            const { client, accounts, log, get } = await setup();
            const [bank, cash] = accounts;
            await client.put(`/expenses/accounts/${bank._id}`, { openingBalance: 1000 });

            await log({ type: "income", amount: 500, transactionDate: `${lastMonth}-03` });
            await log({ amount: 120, transactionDate: `${thisMonth}-01` });
            await log({ type: "transfer", amount: 300, transferToAccountId: cash._id, transactionDate: `${thisMonth}-01` });
            await log({ amount: 45, accountId: cash._id, transactionDate: `${thisMonth}-01` });
            const mistake = await log({ amount: 999, transactionDate: `${thisMonth}-01` });
            await client.delete(`/expenses/transactions/${mistake._id}`);

            const expected = [1000 + 500 - 120 - 300, 300 - 45];
            const summary = await get("/expenses/summary");
            assert.deepEqual(summary.accounts.map((account) => account.currentBalance), expected);
            assert.deepEqual(
                (await get("/expenses/accounts")).accounts.map((account) => account.currentBalance),
                expected,
            );
            assert.equal(summary.monthExpensesTotal, 165);
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

    describe("the list, a page at a time", () => {
        it("hands over as many as asked for, after as many as asked, and says how many there are", async () => {
            const { log, get } = await setup();
            const ids = [];
            for (let day = 1; day <= 5; day++) {
                ids.push((await log({ amount: day, transactionDate: `${earlier}-0${day}` }))._id);
            }
            await log({ amount: 40, transactionDate: `${thisMonth}-01` });
            const newestFirst = ids.toReversed();

            const page = async (query) => {
                const { transactions, total } = await get(`/expenses/transactions?month=${earlier}&${query}`);
                return { ids: transactions.map((transaction) => transaction._id), total };
            };

            assert.deepEqual(await page("limit=2"), { ids: newestFirst.slice(0, 2), total: 5 });
            assert.deepEqual(await page("limit=2&offset=2"), { ids: newestFirst.slice(2, 4), total: 5 });
            assert.deepEqual(await page("limit=2&offset=4"), { ids: newestFirst.slice(4), total: 5 });
            assert.deepEqual(await page("limit=2&offset=6"), { ids: [], total: 5 });

            // Every month together counts the other one too
            assert.equal((await get("/expenses/transactions?limit=1")).total, 6);
        });

        it("stops at 100 when no number is given", async () => {
            const { client, accounts, get } = await setup();
            await Promise.all(
                Array.from({ length: 103 }, (_, index) =>
                    client.post("/expenses/transactions", {
                        type: "expense",
                        accountId: accounts[0]._id,
                        amount: index + 1,
                        transactionDate: `${earlier}-10`,
                    }),
                ),
            );

            const first = await get(`/expenses/transactions?month=${earlier}`);
            const rest = await get(`/expenses/transactions?month=${earlier}&offset=100`);

            assert.equal(first.transactions.length, 100);
            assert.equal(first.total, 103);
            assert.equal(rest.transactions.length, 3);
            assert.equal(
                new Set([...first.transactions, ...rest.transactions].map((transaction) => transaction._id)).size,
                103,
            );

            // The month's figures are of the whole month, not of a page
            const summary = await get(`/expenses/summary?month=${earlier}`);
            assert.equal(summary.monthExpenseCount, 103);
            assert.equal(summary.monthExpensesTotal, (103 * 104) / 2);
        });

        it("refuses a page that makes no sense", async () => {
            const { client } = await setup();

            for (const query of ["limit=0", "limit=201", "limit=ten", "offset=-1"]) {
                const response = await client.get(`/expenses/transactions?${query}`);
                assert.equal(response.status, 400, query);
            }
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
