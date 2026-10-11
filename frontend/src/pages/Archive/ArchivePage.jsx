import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import { Button, EmptyState, ErrorState, IconButton, Menu, Skeleton } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import {
    ARCHIVE_EMPTY_WORDS,
    archiveDeletedWords,
    archivedFactsWords,
    archivedItems,
    archivedWhenWords,
    archiveWords,
    NOT_ARCHIVE_DELETED_WORDS,
} from "../../lib/archiveWords";
import { cx } from "../../lib/cx";
import { localDay } from "../../lib/dates";
import { toast } from "../../lib/toast";
import { firstDayOfWeek } from "../../lib/week";
import archiveService from "../../services/archiveService";
import habitService from "../../services/habitService";
import routineService from "../../services/routineService";
import trashService from "../../services/trashService";
import { itemPath } from "../Plan/planPaths";
import styles from "./ArchivePage.module.css";

const removers = { routine: routineService.deleteRoutine, habit: habitService.deleteHabit };

/**
 * One retired routine or habit: what it is called, what it was, when it was retired and how it went,
 * and the way back into the plan. It leaves the list by its own height.
 *
 * entry: from archivedItems. words: { today, firstDay }. busy: it is on its way back.
 * onBringBack(entry), onDelete(entry)
 */
const ArchiveRow = ({ entry, words, busy, onBringBack, onDelete }) => {
    const navigate = useNavigate();
    const isPresent = useIsPresent();
    const { item } = entry;

    return (
        <m.li
            className={cx(styles.frame, !isPresent && styles.clipped)}
            initial={false}
            exit={{ height: 0, opacity: 0 }}
        >
            <div className={styles.row}>
                <div className={styles.main}>
                    <Link to={itemPath(item)} className={styles.name}>
                        {item.title}
                    </Link>
                    <p className={styles.meta}>{archivedFactsWords(item, words)}</p>
                    <p className={styles.meta}>{archivedWhenWords(item.source)}</p>
                </div>
                <div className={styles.actions}>
                    <Button size="sm" icon="undo" loading={busy} onClick={() => onBringBack(entry)}>
                        Bring back
                    </Button>
                    <Menu align="end" trigger={<IconButton icon="more" size="sm" label={`Options for ${item.title}`} />}>
                        <Menu.Item icon="history" onSelect={() => navigate(itemPath(item))}>
                            History
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(entry)}>
                            Delete
                        </Menu.Item>
                    </Menu>
                </div>
            </div>
        </m.li>
    );
};

// The widths of the placeholder names. Uneven on purpose, like real ones.
const LINES = ["16ch", "22ch", "12ch"];

const ArchiveSkeleton = () => (
    <ul className={styles.rows} aria-hidden="true">
        {LINES.map((width) => (
            <li key={width} className={styles.row}>
                <div className={styles.main}>
                    <div className={cx(styles.name, styles.line)}>
                        <Skeleton variant="text" width={width} />
                    </div>
                    <div className={cx(styles.meta, styles.line)}>
                        <Skeleton variant="text" width="24ch" />
                    </div>
                </div>
            </li>
        ))}
    </ul>
);

/**
 * Archive: the routines and habits that have been retired. Unlike Trash, nothing here ever expires: each one
 * is kept with its whole history, can be looked back on, and can be brought back into the plan at any time.
 */
const ArchivePage = () => {
    const { user } = useAuth();
    const { bringBackItem } = usePlan();
    const today = useToday();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const { data, status, retry, update } = useFetched(`archive:${account}`, archiveService.getArchive);
    const [firstDay] = useState(firstDayOfWeek);
    // What is on its way back into the plan, by key
    const [bringing, setBringing] = useState(() => new Set());

    // Bringing something back puts it on today, so today has to be there to put it on
    const { ensure } = today;
    useEffect(() => {
        ensure();
    }, [ensure]);

    const entries = archivedItems(data);
    const words = { today: today.date ?? localDay(), firstDay };

    const drop = (key) =>
        update((held) => ({
            routines: held.routines.filter((routine) => `routine:${routine._id}` !== key),
            habits: held.habits.filter((habit) => `habit:${habit._id}` !== key),
        }));

    const bringBack = async (entry) => {
        setBringing((current) => new Set(current).add(entry.key));

        const back = await bringBackItem(entry.kind, entry.item.source);
        if (back) drop(entry.key);

        setBringing((current) => {
            const next = new Set(current);
            next.delete(entry.key);
            return next;
        });
        retry();
    };

    // Deleting from here sends it to Trash like any other delete; recovering it from there brings it back here
    const remove = async (entry) => {
        const { kind, item } = entry;
        drop(entry.key);

        try {
            await removers[kind](item.id);
        } catch {
            toast.error(NOT_ARCHIVE_DELETED_WORDS);
            retry();
            return;
        }

        toast(archiveDeletedWords(item.title), {
            id: `archive-deleted-${item.id}`,
            action: {
                label: "Undo",
                onClick: () =>
                    trashService
                        .restore(kind, item.id)
                        .catch((error) => toast.error(error.message))
                        .finally(retry),
            },
        });
        retry();
    };

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{status === "ready" ? archiveWords(entries.length) : " "}</p>
                <h1 className={styles.title}>Archive</h1>
            </div>
        </header>
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="Archive didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    return (
        <Page>
            <DayLayout>
                {header}

                {status !== "ready" ? (
                    <>
                        <p className="visually-hidden" role="status">
                            Loading Archive
                        </p>
                        <ArchiveSkeleton />
                    </>
                ) : entries.length === 0 ? (
                    <EmptyState className={styles.state} segments={0} title="Nothing is retired">
                        {ARCHIVE_EMPTY_WORDS}
                    </EmptyState>
                ) : (
                    <ul className={styles.rows}>
                        <AnimatePresence initial={false}>
                            {entries.map((entry) => (
                                <ArchiveRow
                                    key={entry.key}
                                    entry={entry}
                                    words={words}
                                    busy={bringing.has(entry.key)}
                                    onBringBack={bringBack}
                                    onDelete={remove}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </DayLayout>
        </Page>
    );
};

export default ArchivePage;
