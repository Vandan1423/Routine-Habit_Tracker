import { useMemo } from "react";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import { monthOf } from "../../lib/dates";
import {
    buildExpenseMonth,
    dayOfDate,
    limitPayload,
    openingFor,
    paymentOf,
    removedLimit,
} from "../../lib/expenses";
import {
    categoryLabel,
    failureWords,
    monthLabel,
    paidWords,
    SAVED_WORDS,
} from "../../lib/expenseWords";
import { toast } from "../../lib/toast";
import expenseService from "../../services/expenseService";
import trashService from "../../services/trashService";

const NOT_DELETED = "It couldn’t be deleted. Check your connection and try again.";
const NOT_PUT_BACK = "It couldn’t be put back. Check your connection and try again.";

// The same list without one of its members
const without = (list, id) => list.filter((member) => member._id !== id);

// The same list with one member changed
const changed = (list, id, fields) => list.map((member) => (member._id === id ? { ...member, ...fields } : member));

/**
 * One month of the account's money, and every way the Expenses screen changes it.
 * The month is read from the API and kept for the session, so turning back to it shows it at once.
 * A change that takes something away (a delete, a pause) is shown first and sent after; one that adds or
 * rewrites waits for the server. What is deleted goes to Trash, and Undo brings the same record back. Either way the month is read again afterwards, so every figure on the
 * screen is the server's own.
 *
 * month: "YYYY-MM". onShowMonth(month): the reader asked to be taken to another month (from a toast).
 * Returns { model, status, retry } and the changes. The ones a form calls reject when they fail, so the
 * form can say why; the ones behind a single press say so themselves, in a toast.
 */
const useExpenses = (month, { onShowMonth } = {}) => {
    const { user } = useAuth();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const { data, status, retry, update } = useFetched(`expenses:${account}:${month}`, () =>
        expenseService.getMonth(month),
    );

    const model = useMemo(
        () => (data ? buildExpenseMonth({ summary: data.summary, transactions: data.transactions }) : null),
        [data],
    );

    const updateSummary = (change) => update((held) => ({ ...held, summary: change(held.summary) }));
    const today = model?.today ?? "";

    // ── Transactions ──

    const saveTransaction = async (payload, existing = null) => {
        const { transaction } = existing
            ? await expenseService.updateTransaction(existing._id, payload)
            : await expenseService.createTransaction(payload);
        retry();

        // Dated in another month, it will not show up on this one: say where it went
        const landed = monthOf(dayOfDate(transaction.transactionDate));
        if (landed !== month) {
            toast(`${SAVED_WORDS[transaction.type][existing ? "moved" : "made"]} to ${monthLabel(landed, today)}`, {
                action: { label: "Show", onClick: () => onShowMonth?.(landed) },
            });
        }

        return transaction;
    };

    const restoreTransaction = async (transaction) => {
        try {
            await trashService.restore("transaction", transaction._id);
            retry();
        } catch (error) {
            toast.error(failureWords(error, NOT_PUT_BACK));
        }
    };

    // Gone from the page at once, with a moment to take it back
    const removeTransaction = async (transaction) => {
        update((held) => ({ ...held, transactions: without(held.transactions, transaction._id) }));

        try {
            await expenseService.deleteTransaction(transaction._id);
            toast(SAVED_WORDS[transaction.type].gone, {
                action: { label: "Undo", onClick: () => restoreTransaction(transaction) },
            });
        } catch (error) {
            toast.error(failureWords(error, NOT_DELETED));
        } finally {
            retry();
        }
    };

    // ── Subscriptions ──

    const saveSubscription = async (payload, existing = null) => {
        const { subscription } = existing
            ? await expenseService.updateSubscription(existing._id, payload)
            : await expenseService.createSubscription(payload);
        retry();

        return subscription;
    };

    const restoreSubscription = async (subscription) => {
        try {
            await trashService.restore("subscription", subscription._id);
        } catch (error) {
            toast.error(failureWords(error, NOT_PUT_BACK));
        } finally {
            retry();
        }
    };

    const removeSubscription = async (subscription) => {
        updateSummary((summary) => ({ ...summary, subscriptions: without(summary.subscriptions, subscription._id) }));

        try {
            await expenseService.deleteSubscription(subscription._id);
            toast(`${subscription.name} moved to Trash`, {
                action: { label: "Undo", onClick: () => restoreSubscription(subscription) },
            });
        } catch (error) {
            toast.error(failureWords(error, NOT_DELETED));
        } finally {
            retry();
        }
    };

    const setSubscriptionRunning = async (subscription, running) => {
        updateSummary((summary) => ({
            ...summary,
            subscriptions: changed(summary.subscriptions, subscription._id, { isActive: running }),
        }));

        try {
            await expenseService.updateSubscription(subscription._id, { isActive: running });
        } catch (error) {
            toast.error(failureWords(error));
        } finally {
            retry();
        }
    };

    // Takes a payment back: the expense goes, and the subscription falls due when it did before
    const unpay = async (subscription, transaction) => {
        try {
            await expenseService.deleteTransaction(transaction._id);
            // Logged a moment ago and taken straight back: not something to keep in Trash
            await trashService.erase("transaction", transaction._id).catch(() => {});
            await expenseService.updateSubscription(subscription.id, { nextDueDate: subscription.due });
        } catch (error) {
            toast.error(failureWords(error, "The payment couldn’t be taken back. Check your connection and try again."));
        } finally {
            retry();
        }
    };

    /**
     * Marks a subscription as paid: logs the payment as an expense dated today, from the subscription's
     * own account, and moves its due date on by one week, month or year.
     * @param {Object} subscription - from buildExpenseMonth
     */
    const paySubscription = async (subscription) => {
        const payment = paymentOf(subscription, today, model?.accounts);

        updateSummary((summary) => ({
            ...summary,
            subscriptions: changed(summary.subscriptions, subscription.id, { nextDueDate: payment.nextDue }),
        }));

        let logged = null;
        try {
            logged = (await expenseService.createTransaction(payment.transaction)).transaction;
            await expenseService.updateSubscription(subscription.id, { nextDueDate: payment.nextDue });

            const words = paidWords(subscription, payment.nextDue);
            toast(words.message, {
                detail: words.detail,
                action: { label: "Undo", onClick: () => unpay(subscription, logged) },
            });
        } catch (error) {
            toast.error(
                logged
                    ? `The payment was logged, but ${subscription.name}’s due date didn’t move. Set it by editing the subscription.`
                    : failureWords(error, "The payment couldn’t be logged. Check your connection and try again."),
            );
        } finally {
            retry();
        }
    };

    // ── Limits ──

    const saveLimit = async (form, existing = null) => {
        await expenseService.saveBudget(limitPayload(form, existing));
        retry();
    };

    const removeLimit = async (budget) => {
        updateSummary((summary) => ({ ...summary, budgets: without(summary.budgets ?? [], budget._id) }));

        try {
            await expenseService.saveBudget(removedLimit(budget));
            toast(`Limit on ${categoryLabel(budget.category).toLowerCase()} removed`, {
                action: {
                    label: "Undo",
                    onClick: async () => {
                        try {
                            await expenseService.saveBudget({ ...removedLimit(budget), isActive: true });
                        } catch (error) {
                            toast.error(failureWords(error, NOT_PUT_BACK));
                        } finally {
                            retry();
                        }
                    },
                },
            });
        } catch (error) {
            toast.error(failureWords(error));
        } finally {
            retry();
        }
    };

    // ── Accounts ──

    /**
     * Sets what accounts hold right now.
     * @param {Object[]} balances - [{ account, wanted }], with `account` from buildExpenseMonth
     */
    const setBalances = async (balances) => {
        try {
            await Promise.all(
                balances.map(({ account, wanted }) =>
                    expenseService.updateAccount(account.id, { openingBalance: openingFor(account, wanted) }),
                ),
            );
        } finally {
            // Whatever was saved shows, even if one of them failed
            retry();
        }
    };

    // ── The month as a file ──

    const exportMonth = async () => {
        try {
            const file = await expenseService.exportMonth(month);
            const url = URL.createObjectURL(new Blob([file], { type: "text/csv;charset=utf-8;" }));
            const link = document.createElement("a");

            link.href = url;
            link.download = `expenses-${month}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("The export didn’t download. Check your connection and try again.", {
                action: { label: "Try again", onClick: exportMonth },
            });
        }
    };

    return {
        model,
        status,
        retry,
        saveTransaction,
        removeTransaction,
        saveSubscription,
        removeSubscription,
        setSubscriptionRunning,
        paySubscription,
        saveLimit,
        removeLimit,
        setBalances,
        exportMonth,
    };
};

export default useExpenses;
