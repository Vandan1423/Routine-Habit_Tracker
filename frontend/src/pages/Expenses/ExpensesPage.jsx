import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import BalancesDialog from "./BalancesDialog";
import ExpensesSkeleton, { ChartSkeleton } from "./ExpensesSkeleton";
import { EXPENSES_PATH, expensesPath } from "./expensePaths";
import LimitDialog from "./LimitDialog";
import SubscriptionEditor from "./SubscriptionEditor";
import SubscriptionRow from "./SubscriptionRow";
import TransactionEditor from "./TransactionEditor";
import TransactionRow from "./TransactionRow";
import useExpenses from "./useExpenses";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import {
    Button,
    EmptyState,
    ErrorState,
    Fact,
    Facts,
    IconButton,
    ProgressBar,
    SectionHeader,
    Tooltip,
} from "../../components/ui";
import useHotkeys from "../../hooks/useHotkeys";
import useLastValue from "../../hooks/useLastValue";
import useListKeys, { focusRow } from "../../hooks/useListKeys";
import useMediaQuery from "../../hooks/useMediaQuery";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { addMonths, formatMonth, isMonth, localDay, monthOf } from "../../lib/dates";
import { monthBounds } from "../../lib/expenses";
import {
    balanceWords,
    categoryLabel,
    ledgerDayWords,
    limitSpoken,
    limitWords,
    monthLabel,
    monthWords,
    NOTHING_LOGGED,
    nothingInMonth,
    subscribedWords,
} from "../../lib/expenseWords";
import { formatMoney } from "../../lib/money";
import { KEYS } from "../../lib/shortcuts";
import styles from "./ExpensesPage.module.css";

// The pictures are drawn by a chart library that the rest of the screen does not need. It is asked for
// as soon as the screen's own code runs, so it is usually here by the time the month's figures are.
const loadCharts = () => import("./charts");
loadCharts().catch(() => {});

const MonthsChart = lazy(() => loadCharts().then((charts) => ({ default: charts.MonthsChart })));
const CategoryChart = lazy(() => loadCharts().then((charts) => ({ default: charts.CategoryChart })));
const PlacesChart = lazy(() => loadCharts().then((charts) => ({ default: charts.PlacesChart })));

// As tall as the pictures themselves (see charts.jsx), so their places can be held for them
const MONTHS_HEIGHT = 148;
const CATEGORY_ROW = 30;
const RING_HEIGHT = 116;

// The ledger opens on the latest days that have anything in them
const LATEST_DAYS = 3;

// A chart with the arrow keys of its own: while one is focused, the arrows are not the page's to use
const inPicture = () => Boolean(document.activeElement?.closest?.(".recharts-wrapper"));

/**
 * Expenses: one month of the account's money. What was spent, in a sentence; six months as a line;
 * the latest of the ledger; where the month went; how any limits stand; and what is paid again and again.
 * Beside it, what the accounts hold. The address holds the month ("/expenses/2026-09"), or nothing for
 * the one today is in. The figures are the server's (lib/expenses.js lays them out); the words are in
 * lib/expenseWords.js.
 */
const ExpensesPage = () => {
    const { month: asked } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { date } = useToday();
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone

    const valid = asked === undefined || isMonth(asked);
    const deviceMonth = monthOf(date ?? localDay());
    const month = valid && asked ? asked : deviceMonth;

    const showMonth = (next, currentMonth = deviceMonth) =>
        navigate(expensesPath(next, currentMonth), { replace: true });

    const expenses = useExpenses(month, { onShowMonth: showMonth });
    const { model, status } = expenses;
    // The accounts and how far the months reach are the same whichever month is on show:
    // what was last known stays in place while another month is on its way
    const known = useLastValue(model);

    const [editing, setEditing] = useState(null);
    const [subscribing, setSubscribing] = useState(null);
    const [limiting, setLimiting] = useState(null);
    const [balancing, setBalancing] = useState(false);
    // The month whose whole ledger has been asked for
    const [unfolded, setUnfolded] = useState(null);

    // Arrived by "New expense" from somewhere else: the form opens once the accounts are known,
    // and the address then forgets that it was asked for, so coming back to it does not open the form again
    const wantsNew = location.state?.add ?? null;
    const [answered, setAnswered] = useState(null);
    if (wantsNew && model && answered !== location.key) {
        setAnswered(location.key);
        setEditing({ type: wantsNew });
    }
    useEffect(() => {
        if (wantsNew && model) navigate(location.pathname, { replace: true, state: null });
    }, [wantsNew, model, navigate, location.pathname]);

    const today = known?.today ?? date ?? localDay();
    const currentMonth = monthOf(today);
    const bounds = known ? monthBounds(known) : { first: month, last: month };
    const earlier = addMonths(month, -1);
    const later = addMonths(month, 1);
    const canGoEarlier = month > bounds.first;
    const canGoLater = month < bounds.last;

    useHotkeys({
        [KEYS.earlier]: () => (canGoEarlier && !inPicture() ? showMonth(earlier, currentMonth) : false),
        [KEYS.later]: () => (canGoLater && !inPicture() ? showMonth(later, currentMonth) : false),
    });

    // The ledger from the keyboard: Enter on a line opens it as any button does; these are the rest
    // One still on its way to the server is not there to be opened or deleted yet
    const entryOf = (id) => model?.entries.find((entry) => entry.id === id && !entry.pending);
    useListKeys(
        {
            [KEYS.edit]: (id) => {
                const entry = entryOf(id);
                if (!entry) return false;
                setEditing({ transaction: entry.source });
                return true;
            },
            [KEYS.remove]: (id, row, neighbour) => {
                const entry = entryOf(id);
                if (!entry) return false;
                // The line is about to go: the keyboard moves on to the one beside it
                focusRow(neighbour);
                expenses.removeTransaction(entry.source);
                return true;
            },
        },
        Boolean(model) && model.entries.length > 0,
    );

    if (!valid) return <Navigate to={EXPENSES_PATH} replace />;

    // Nothing has ever been logged, and nothing is set up: the screen says what it is for instead
    const untouched = Boolean(model?.untouched) && model.subscriptions.length === 0 && model.limits.length === 0;

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{known ? balanceWords(known) : " "}</p>
                <h1 className={styles.title}>Expenses</h1>
            </div>
            {/* With nothing logged, the page below offers the way to begin itself */}
            {known &&
                !untouched &&
                (isPhone ? (
                    <IconButton
                        icon="plus"
                        label="New expense"
                        variant="secondary"
                        onClick={() => setEditing({ type: "expense" })}
                    />
                ) : (
                    <Tooltip label="New expense" shortcut={KEYS.newExpense}>
                        <Button variant="ghost" icon="plus" onClick={() => setEditing({ type: "expense" })}>
                            New
                        </Button>
                    </Tooltip>
                ))}
        </header>
    );

    const months = (
        <nav className={styles.months} aria-label="Month">
            <h2 className={styles.month} aria-live="polite">
                {formatMonth(month)}
            </h2>
            <Tooltip label={formatMonth(earlier)} shortcut={KEYS.earlier} disabled={!canGoEarlier}>
                <IconButton
                    icon="chevron-left"
                    size="sm"
                    label={`The month before, ${formatMonth(earlier)}`}
                    disabled={!canGoEarlier}
                    onClick={() => showMonth(earlier, currentMonth)}
                />
            </Tooltip>
            <Tooltip label={formatMonth(later)} shortcut={KEYS.later} disabled={!canGoLater}>
                <IconButton
                    icon="chevron-right"
                    size="sm"
                    label={`The month after, ${formatMonth(later)}`}
                    disabled={!canGoLater}
                    onClick={() => showMonth(later, currentMonth)}
                />
            </Tooltip>
            {month !== currentMonth && (
                <Button variant="ghost" size="sm" onClick={() => showMonth(currentMonth, currentMonth)}>
                    This month
                </Button>
            )}
        </nav>
    );

    const aside = known && (
        <>
            <section>
                <h2 className={styles.heading}>Accounts</h2>
                <Facts>
                    {known.accounts.map((account) => (
                        <Fact key={account.id} label={account.name}>
                            {formatMoney(account.balance, known.currency)}
                        </Fact>
                    ))}
                </Facts>
                <Button variant="ghost" size="sm" className={styles.under} onClick={() => setBalancing(true)}>
                    Set balances
                </Button>
            </section>
            {model && (model.spent > 0 || model.income > 0) && (
                <section>
                    <h2 className={styles.heading}>{monthLabel(model.month, today)}</h2>
                    <Facts>
                        <Fact label="Spent">{formatMoney(model.spent, model.currency)}</Fact>
                        {model.income > 0 && <Fact label="Came in">{formatMoney(model.income, model.currency)}</Fact>}
                    </Facts>
                </section>
            )}
            {model && model.places.length > 0 && (
                <section>
                    <h2 className={styles.heading}>Where it was spent</h2>
                    <Suspense fallback={<ChartSkeleton height={RING_HEIGHT} />}>
                        <PlacesChart places={model.places} currency={model.currency} />
                    </Suspense>
                </section>
            )}
        </>
    );

    const forms = known && (
        <>
            <TransactionEditor
                request={editing}
                accounts={known.accounts}
                today={today}
                currency={known.currency}
                places={known.suggestedPlaces}
                onSave={expenses.saveTransaction}
                onDelete={expenses.removeTransaction}
                onClose={() => setEditing(null)}
            />
            <SubscriptionEditor
                request={subscribing}
                accounts={known.accounts}
                today={today}
                currency={known.currency}
                onSave={expenses.saveSubscription}
                onDelete={expenses.removeSubscription}
                onClose={() => setSubscribing(null)}
            />
            <LimitDialog
                request={limiting}
                categories={known.unlimited}
                currency={known.currency}
                onSave={expenses.saveLimit}
                onRemove={expenses.removeLimit}
                onClose={() => setLimiting(null)}
            />
            <BalancesDialog
                open={balancing}
                accounts={known.accounts}
                currency={known.currency}
                onSave={expenses.setBalances}
                onClose={() => setBalancing(false)}
            />
        </>
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    {months}
                    <ErrorState className={styles.state} title="Expenses didn’t load" onRetry={expenses.retry} />
                </DayLayout>
            </Page>
        );
    }

    if (!model) {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading expenses
                </p>
                <DayLayout aside={aside}>
                    {header}
                    {months}
                    <ExpensesSkeleton chartHeight={MONTHS_HEIGHT} />
                </DayLayout>
                {forms}
            </Page>
        );
    }

    const { currency } = model;

    if (untouched) {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <EmptyState
                        className={styles.state}
                        title={NOTHING_LOGGED.title}
                        actions={
                            <>
                                <Button variant="primary" onClick={() => setEditing({ type: "expense" })}>
                                    Add an expense
                                </Button>
                                <Button onClick={() => setBalancing(true)}>Set your balances</Button>
                            </>
                        }
                    >
                        {NOTHING_LOGGED.body}
                    </EmptyState>
                </DayLayout>
                {forms}
            </Page>
        );
    }

    const words = monthWords(model);
    const whole = unfolded === month;
    const shownDays = whole ? model.days : model.days.slice(0, LATEST_DAYS);
    // Lines of the month not on show: folded away, or not read yet (they come a page at a time)
    const hiddenLines = model.count - shownDays.reduce((sum, day) => sum + day.entries.length, 0);
    const hasSeries = model.series.some((point) => point.total > 0);

    return (
        <Page>
            <DayLayout aside={aside}>
                {header}
                {months}

                <p className={styles.summary}>
                    <b>{words.lead}</b> {words.rest}
                </p>

                {hasSeries && (
                    <section className={styles.section} aria-label="Six months">
                        <SectionHeader className={styles.head} title="Six months" />
                        <div className={styles.picture}>
                            <Suspense fallback={<ChartSkeleton height={MONTHS_HEIGHT} />}>
                                <MonthsChart
                                    series={model.series}
                                    currency={currency}
                                    onSelect={(next) => {
                                        const { first, last } = monthBounds(model);
                                        if (next >= first && next <= last) showMonth(next, currentMonth);
                                    }}
                                />
                            </Suspense>
                        </div>
                    </section>
                )}

                <section className={styles.section} aria-label="Transactions">
                    <SectionHeader
                        className={styles.head}
                        title="Transactions"
                        meta={model.count > 0 ? String(model.count) : undefined}
                        actions={
                            model.entries.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={expenses.exportMonth}>
                                    Export
                                </Button>
                            )
                        }
                    />
                    {model.entries.length === 0 ? (
                        <p className={styles.caption}>
                            {model.current ? "Nothing logged yet this month." : nothingInMonth(month, today)}
                        </p>
                    ) : (
                        // Keyed by what is on show: another month, or the whole of this one, is another
                        // ledger, not lines coming and going
                        <div key={`${month}:${whole}`}>
                            <AnimatePresence initial={false}>
                                {shownDays.map((day) => (
                                    <TransactionDay
                                        key={day.date}
                                        day={day}
                                        today={today}
                                        currency={currency}
                                        onEdit={(transaction) => setEditing({ transaction })}
                                        onDelete={expenses.removeTransaction}
                                    />
                                ))}
                            </AnimatePresence>
                            {hiddenLines > 0 && (
                                <div className={styles.more}>
                                    {whole ? (
                                        // Everything read is on show: the rest of a long month is read on request
                                        <Button
                                            size="sm"
                                            loading={expenses.readingEarlier}
                                            onClick={expenses.showEarlier}
                                        >
                                            Show earlier
                                        </Button>
                                    ) : (
                                        <Button size="sm" onClick={() => setUnfolded(month)}>
                                            Show the whole month
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {model.categories.length > 0 && (
                    <section className={styles.section} aria-label="Where it went">
                        <SectionHeader className={styles.head} title="Where it went" />
                        <div className={styles.picture}>
                            <Suspense fallback={<ChartSkeleton height={model.categories.length * CATEGORY_ROW} />}>
                                <CategoryChart categories={model.categories} currency={currency} />
                            </Suspense>
                        </div>
                    </section>
                )}

                <section className={styles.section} aria-label="Limits">
                    <SectionHeader
                        className={styles.head}
                        title="Limits"
                        actions={
                            model.unlimited.length > 0 && (
                                <Button variant="ghost" size="sm" icon="plus" onClick={() => setLimiting({})}>
                                    Set a limit
                                </Button>
                            )
                        }
                    />
                    {model.limits.length === 0 ? (
                        <p className={styles.caption}>
                            No limits are set. A limit is the most a category should take in one month.
                        </p>
                    ) : (
                        <ul className={styles.rows}>
                            {model.limits.map((limit) => (
                                <li key={limit.category}>
                                    <button
                                        type="button"
                                        className={cx(styles.limit, limit.status === "over" && styles.over)}
                                        aria-label={`${limitSpoken(limit, currency)}. Edit.`}
                                        onClick={() => setLimiting({ limit })}
                                    >
                                        <span className={styles.limitName}>{categoryLabel(limit.category)}</span>
                                        <span className={styles.limitWords}>{limitWords(limit, currency)}</span>
                                        <ProgressBar
                                            className={styles.limitBar}
                                            size="md"
                                            value={limit.spent}
                                            max={limit.limit || 1}
                                        />
                                        <span className={styles.limitFigures}>
                                            {formatMoney(limit.spent, currency)} of {formatMoney(limit.limit, currency)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={styles.section} aria-label="Subscriptions">
                    <SectionHeader
                        className={styles.head}
                        title="Subscriptions"
                        meta={subscribedWords(model) || undefined}
                        actions={
                            <Button variant="ghost" size="sm" icon="plus" onClick={() => setSubscribing({})}>
                                Add
                            </Button>
                        }
                    />
                    {model.subscriptions.length === 0 ? (
                        <p className={styles.caption}>
                            Nothing here yet. Add what you pay again and again, such as rent, to see when it
                            next falls due.
                        </p>
                    ) : (
                        <ul className={styles.rows}>
                            {model.subscriptions.map((subscription) => (
                                <SubscriptionRow
                                    key={subscription.id}
                                    subscription={subscription}
                                    currency={currency}
                                    onPay={expenses.paySubscription}
                                    onEdit={(source) => setSubscribing({ subscription: source })}
                                    onRun={expenses.setSubscriptionRunning}
                                    onDelete={expenses.removeSubscription}
                                />
                            ))}
                        </ul>
                    )}
                </section>
            </DayLayout>
            {forms}
        </Page>
    );
};

/**
 * One day of the ledger: its name, what it spent, and its lines. It comes with its first line and
 * leaves with its last, by its own height.
 * day: from buildExpenseMonth. The rest is passed to each line.
 */
const TransactionDay = ({ day, today, currency, onEdit, onDelete }) => {
    const isPresent = useIsPresent();
    const [resizing, setResizing] = useState(false);

    return (
        <m.div
            className={cx(styles.ledgerDay, (resizing || !isPresent) && styles.clipped)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onAnimationStart={() => setResizing(true)}
            onAnimationComplete={() => setResizing(false)}
        >
            <h3 className={styles.ledgerHead}>
                <span>{ledgerDayWords(day.date, today)}</span>
                {day.spent > 0 && (
                    <span>
                        <span className="visually-hidden">Spent </span>
                        {formatMoney(day.spent, currency)}
                    </span>
                )}
            </h3>
            <ul>
                <AnimatePresence initial={false}>
                    {day.entries.map((entry) => (
                        <TransactionRow
                            key={entry.key}
                            entry={entry}
                            currency={currency}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </AnimatePresence>
            </ul>
        </m.div>
    );
};

export default ExpensesPage;
