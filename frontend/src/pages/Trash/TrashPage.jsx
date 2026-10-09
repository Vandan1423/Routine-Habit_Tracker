import { useState } from "react";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import TrashDays from "../../components/trash/TrashDays";
import { Button, ConfirmDialog, EmptyState, ErrorState, IconButton, Menu, Skeleton } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import useLastValue from "../../hooks/useLastValue";
import useNow from "../../hooks/useNow";
import usePlan from "../../hooks/usePlan";
import useTodos from "../../hooks/useTodos";
import { cx } from "../../lib/cx";
import { localDay } from "../../lib/dates";
import { toast } from "../../lib/toast";
import {
    DEFAULT_TRASH_DAYS,
    EMPTIED_WORDS,
    emptyWords,
    erasedWords,
    eraseWords,
    goesWords,
    heldWords,
    metaOf,
    NOT_ERASED_WORDS,
    NOT_RECOVERED_WORDS,
    recoveredWords,
    titleOf,
    TRASH_DAYS_NOTE,
    trashWords,
} from "../../lib/trashWords";
import { firstDayOfWeek } from "../../lib/week";
import trashService from "../../services/trashService";
import styles from "./TrashPage.module.css";

const keyOf = (item) => `${item.kind}:${item.id}`;

/**
 * One thing in Trash: what it is called, what it is, how long it has left, and the two ways out of here.
 * It leaves the list by its own height.
 *
 * item: one of GET /trash's items. words: { today, firstDay } for saying when it fell. now: for how long it has left.
 * busy: it is being recovered. onRecover(item), onErase(item)
 */
const TrashRow = ({ item, words, now, busy, onRecover, onErase }) => {
    const isPresent = useIsPresent();
    const title = titleOf(item);
    const held = heldWords(item);
    const goes = goesWords(item.purgeAt, now);

    return (
        <m.li
            className={cx(styles.frame, !isPresent && styles.clipped)}
            initial={false}
            exit={{ height: 0, opacity: 0 }}
        >
            <div className={styles.row}>
                <div className={styles.main}>
                    <p className={styles.name}>{title}</p>
                    <p className={styles.meta}>
                        {metaOf(item, words)}
                        {held && (
                            <>
                                {" · "}
                                <b>{held}</b>
                            </>
                        )}
                        <span className={styles.whenInline}>
                            {" · "}
                            {goes}
                        </span>
                    </p>
                </div>
                <span className={styles.when}>{goes}</span>
                <div className={styles.actions}>
                    <Button size="sm" icon="undo" loading={busy} onClick={() => onRecover(item)}>
                        Recover
                    </Button>
                    <Menu align="end" trigger={<IconButton icon="more" size="sm" label={`Options for ${title}`} />}>
                        <Menu.Item icon="trash" tone="danger" onSelect={() => onErase(item)}>
                            Erase now
                        </Menu.Item>
                    </Menu>
                </div>
            </div>
        </m.li>
    );
};

// The widths of the placeholder names. Uneven on purpose, like real ones.
const LINES = ["18ch", "11ch", "24ch"];

const TrashSkeleton = () => (
    <ul className={styles.rows} aria-hidden="true">
        {LINES.map((width) => (
            <li key={width} className={styles.row}>
                <div className={styles.main}>
                    <div className={cx(styles.name, styles.line)}>
                        <Skeleton variant="text" width={width} />
                    </div>
                    <div className={cx(styles.meta, styles.line)}>
                        <Skeleton variant="text" width="26ch" />
                    </div>
                </div>
            </li>
        ))}
    </ul>
);

/**
 * Trash: everything that has been deleted, of every kind, in one place. Each thing waits here for as long
 * as the account has chosen, counted from the moment it was deleted, and can be recovered exactly as it
 * was until then. A routine or a habit took the XP it had earned with it, and brings it back.
 */
const TrashPage = () => {
    const { user, fetchGamificationStats } = useAuth();
    const plan = usePlan();
    const todos = useTodos();
    const now = useNow();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const { data, status, retry, update } = useFetched(`trash:${account}`, trashService.getTrash);
    const [firstDay] = useState(firstDayOfWeek);
    // What is on its way out of Trash, by key, and the question before something is erased
    const [recovering, setRecovering] = useState(() => new Set());
    const [erasing, setErasing] = useState(null);
    const [emptying, setEmptying] = useState(false);

    const items = data?.items ?? [];
    const days = user?.trashDays ?? data?.days ?? DEFAULT_TRASH_DAYS;
    const words = { today: localDay(now), firstDay };

    // The question stays worded while its dialog closes
    const asked = useLastValue(erasing);
    const question = asked ? eraseWords(asked) : null;
    const emptyQuestion = emptyWords(items);

    const drop = (gone) =>
        update((held) => ({ ...held, items: held.items.filter((item) => !gone.has(keyOf(item))) }));

    // What a thing coming back changes elsewhere: the plan and today, the level, the to-do lists
    const afterRecovery = (item) => {
        if (item.kind === "routine" || item.kind === "habit") {
            plan.ensure();
            fetchGamificationStats?.();
        } else if (item.kind === "todo" || item.kind === "todoList") {
            todos.refresh();
        }
    };

    const recover = async (item) => {
        const key = keyOf(item);
        setRecovering((current) => new Set(current).add(key));

        try {
            const answer = await trashService.restore(item.kind, item.id);
            drop(new Set([key]));
            afterRecovery(item);

            const said = recoveredWords(item, answer.xpReturned);
            toast(said.message, { detail: said.detail });
        } catch (error) {
            // The server says why when it has a reason of its own (a to-do whose list is still in Trash)
            toast.error(error?.cause?.response?.status === 409 ? error.message : NOT_RECOVERED_WORDS);
        } finally {
            setRecovering((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
            });
            retry();
        }
    };

    const erase = async () => {
        const item = erasing;

        try {
            await trashService.erase(item.kind, item.id);
        } catch (error) {
            toast.error(NOT_ERASED_WORDS);
            throw error;
        }
        drop(new Set([keyOf(item)]));
        toast(erasedWords(item));
        retry();
    };

    const empty = async () => {
        try {
            await trashService.empty();
        } catch (error) {
            toast.error(NOT_ERASED_WORDS);
            throw error;
        }
        update((held) => ({ ...held, items: [] }));
        toast(EMPTIED_WORDS);
        retry();
    };

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{status === "ready" ? trashWords(items.length, days) : " "}</p>
                <h1 className={styles.title}>Trash</h1>
            </div>
            {items.length > 0 && (
                <Button variant="danger" onClick={() => setEmptying(true)}>
                    Empty Trash
                </Button>
            )}
        </header>
    );

    const keep = (
        <div className={styles.keep}>
            <div>
                <p className={styles.keepName}>Keep deleted things for</p>
                <p className={styles.keepNote}>{TRASH_DAYS_NOTE}</p>
            </div>
            <TrashDays />
        </div>
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="Trash didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    return (
        <Page>
            <DayLayout>
                {header}
                {keep}

                {status !== "ready" ? (
                    <>
                        <p className="visually-hidden" role="status">
                            Loading Trash
                        </p>
                        <TrashSkeleton />
                    </>
                ) : items.length === 0 ? (
                    <EmptyState className={styles.state} segments={0} title="Trash is empty">
                        Routines, habits, to-dos, goals, expenses and subscriptions come here when you
                        delete them, and can be recovered exactly as they were until their time runs out.
                    </EmptyState>
                ) : (
                    <ul className={styles.rows}>
                        <AnimatePresence initial={false}>
                            {items.map((item) => (
                                <TrashRow
                                    key={keyOf(item)}
                                    item={item}
                                    words={words}
                                    now={now}
                                    busy={recovering.has(keyOf(item))}
                                    onRecover={recover}
                                    onErase={setErasing}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </DayLayout>

            <ConfirmDialog
                open={Boolean(erasing)}
                onOpenChange={(open) => {
                    if (!open) setErasing(null);
                }}
                title={question?.title}
                description={question?.description}
                confirmLabel={question?.confirm}
                tone="danger"
                onConfirm={erase}
            />
            <ConfirmDialog
                open={emptying}
                onOpenChange={setEmptying}
                title={emptyQuestion.title}
                description={emptyQuestion.description}
                confirmLabel={emptyQuestion.confirm}
                tone="danger"
                onConfirm={empty}
            />
        </Page>
    );
};

export default TrashPage;
