import { useMemo, useState } from "react";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import { monthOf } from "../../lib/dates";
import {
    buildExpenseMonth,
    dayOfDate,
    draftSubscription,
    draftTransaction,
    joinPages,
    limitPayload,
    openingFor,
    paymentOf,
    removedLimit,
    withBudget,
    withSubscription,
    withTransaction,
} from "../../lib/expenses";
import {
    categoryLabel,
    failureWords,
    monthLabel,
    paidWords,
    REFUSED_WORDS,
    SAVED_WORDS,
} from "../../lib/expenseWords";
import { toast } from "../../lib/toast";
import expenseService from "../../services/expenseService";
import { newKey } from "../../services/outbox";
import trashService from "../../services/trashService";

const NOT_DELETED = "It couldn’t be deleted. Check your connection and try again.";
const NOT_PUT_BACK = "It couldn’t be put back. Check your connection and try again.";

// A transaction shown before it was saved is drawn under a key of ours, and its line keeps that key once
// the server has given the transaction an id, so the line stays where it is. By saved id, for the session.
const lineKeys = new Map();
let drafted = 0;

// A key no line has been drawn under before, whichever visit to the screen asks
const newLineKey = () => {
    drafted += 1;
    return `draft:${drafted}`;
};

// The same list without one of its members
const without = (list, id) => list.filter((member) => member._id !== id);

// The same list with one member changed
const changed = (list, id, fields) => list.map((member) => (member._id === id ? { ...member, ...fields } : member));

/**
 * One month of the account's money, and every way the Expenses screen changes it.
 * The month is read from the API and kept for the session, so turning back to it shows it at once.
 * Its figures are whole; its transactions come a page at a time, the latest first (showEarlier reads on).
 * Every change is shown first and sent after: no form waits for the server. If the server refuses, the
 * change is taken back and a toast says so. What is deleted goes to Trash, and Undo brings the same
 * record back. Either way the month is read again afterwards, so every figure on the screen is the
 * server's own.
 *
 * month: "YYYY-MM". onShowMonth(month): the reader asked to be taken to another month (from a toast).
 * Returns { model, status, retry }, showEarlier with readingEarlier (it is under way), and the changes.
 */
const useExpenses = (month, { onShowMonth } = {}) => {
    const { user } = useAuth();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    // How many pages of this month's transactions have been asked for. Reading the month again reads as many.
    const [asked, setAsked] = useState({ month, pages: 1 });
    const pages = asked.month === month ? asked.pages : 1;
    const [readingEarlier, setReadingEarlier] = useState(false);

    const { data, status, retry, update } = useFetched(`expenses:${account}:${month}`, () =>
        expenseService.getMonth(month, pages),
    );

    // What the forms have sent and the server has not answered for yet: { key, lay }, where lay(held)
    // gives the month as it was read with that change laid over it. A reading of the month that comes
    // back meanwhile does not have the change yet, and is shown with it all the same.
    const [unanswered, setUnanswered] = useState([]);

    const model = useMemo(
        () => (data ? buildExpenseMonth({ ...unanswered.reduce((held, change) => change.lay(held), data), keys: lineKeys }) : null),
        [data, unanswered],
    );

    /**
     * Shows a change at once and sends it.
     * lay(held): the month with the change in it, as it is shown meanwhile. send(): the request.
     * settle(held, answer): the month once the server has answered, until it has been read again.
     * refused: what the toast says if the server will not have it. again(): what "Try again" does.
     * then(answer): anything else that follows from the server's answer.
     */
    const sendShown = ({ lay, send, settle, refused, again, then }) => {
        const key = newLineKey();
        const answered = () => setUnanswered((current) => current.filter((change) => change.key !== key));

        setUnanswered((current) => [...current, { key, lay }]);

        send().then(
            (answer) => {
                // The server's own takes the place of what was shown for it, in the same breath
                update((held) => settle(held, answer));
                answered();
                retry();
                then?.(answer);
            },
            (error) => {
                answered();
                // No answer at all is not a refusal: the month is read again, in case the server has it
                if (!error?.cause?.response) retry();
                toast.error(refused, {
                    detail: failureWords(error, "Check your connection and try again."),
                    action: { label: "Try again", onClick: again },
                });
            },
        );
    };

    const updateSummary = (change) => update((held) => ({ ...held, summary: change(held.summary) }));
    const today = model?.today ?? "";

    // ── Transactions ──

    /**
     * Logs a transaction, or rewrites one. It is in the ledger and the figures at once, as the form gave
     * it, and the form does not wait.
     * @param {Object} payload - from transactionPayload
     * @param {Object} [existing] - the transaction it rewrites, as the API sent it
     * @param {String} [sentAs] - the key a new one was sent under before, when this is a second try
     */
    const saveTransaction = (payload, existing = null, sentAs = newKey()) => {
        const line = newLineKey();
        const now = draftTransaction(payload, { id: line, accounts: model?.accounts, existing });

        sendShown({
            lay: (held) => withTransaction(held, now, existing),
            send: async () => {
                const answer = existing
                    ? await expenseService.updateTransaction(existing._id, payload)
                    : await expenseService.createTransaction(payload, sentAs);

                if (!existing) lineKeys.set(answer.transaction._id, line);
                return answer;
            },
            // Unless a reading of the month that came back meanwhile has it already
            settle: (held, { transaction }) =>
                held.transactions.some((entry) => entry._id === transaction._id && entry.updatedAt === transaction.updatedAt)
                    ? held
                    : withTransaction(held, transaction, existing),
            refused: REFUSED_WORDS[payload.type][existing ? "changed" : "made"],
            again: () => saveTransaction(payload, existing, sentAs),
            then: ({ transaction }) => {
                // Dated in another month, it will not show up on this one: say where it went
                const landed = monthOf(dayOfDate(transaction.transactionDate));
                if (landed !== month) {
                    toast(`${SAVED_WORDS[transaction.type][existing ? "moved" : "made"]} to ${monthLabel(landed, today)}`, {
                        action: { label: "Show", onClick: () => onShowMonth?.(landed) },
                    });
                }
            },
        });
    };

    const restoreTransaction = async (transaction) => {
        try {
            await trashService.restore("transaction", transaction._id);
            retry();
        } catch (error) {
            toast.error(failureWords(error, NOT_PUT_BACK));
        }
    };

    // The next page of the month's transactions, added under the ones on show
    const showEarlier = async () => {
        setReadingEarlier(true);

        try {
            const page = await expenseService.getTransactions(month, pages);
            update((held) => ({
                ...held,
                transactions: joinPages(held.transactions, page.transactions ?? []),
                total: page.total ?? held.total,
            }));
            setAsked({ month, pages: pages + 1 });
        } catch (error) {
            toast.error(failureWords(error, "The earlier ones didn’t load. Check your connection and try again."));
        } finally {
            setReadingEarlier(false);
        }
    };

    // Gone from the page at once, with a moment to take it back
    const removeTransaction = async (transaction) => {
        update((held) => ({
            ...held,
            transactions: without(held.transactions, transaction._id),
            total: Math.max(0, (held.total ?? 0) - 1),
        }));

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

    // Adds a subscription, or rewrites one: there at once, as the form gave it
    const saveSubscription = (payload, existing = null, sentAs = newKey()) => {
        const now = draftSubscription(payload, { id: newLineKey(), accounts: model?.accounts, existing });

        sendShown({
            lay: (held) => withSubscription(held, now),
            send: () =>
                existing
                    ? expenseService.updateSubscription(existing._id, payload)
                    : expenseService.createSubscription(payload, sentAs),
            settle: (held, { subscription }) => withSubscription(held, subscription, now._id),
            refused: `${payload.name} wasn’t ${existing ? "changed" : "added"}`,
            again: () => saveSubscription(payload, existing, sentAs),
        });
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
            logged = (await expenseService.createTransaction(payment.transaction, newKey())).transaction;
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

    // Sets a category's limit: shown at once. A category has one limit, so there is nothing here to wait for.
    const saveLimit = (form, existing = null) => {
        const payload = limitPayload(form, existing);
        const now = { ...existing, ...payload };

        sendShown({
            lay: (held) => withBudget(held, now),
            send: () => expenseService.saveBudget(payload),
            settle: (held, answer) => withBudget(held, answer?.budget ?? now),
            refused: `The limit on ${categoryLabel(payload.category).toLowerCase()} wasn’t saved`,
            again: () => saveLimit(form, existing),
        });
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
        showEarlier,
        readingEarlier,
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
