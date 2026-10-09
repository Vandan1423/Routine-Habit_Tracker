import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ErrorState, SectionHeader, Skeleton } from "../../components/ui";
import useFetched from "../../hooks/useFetched";
import { cx } from "../../lib/cx";
import { ledgerDayLabel, ledgerWords, signedXp } from "../../lib/historyWords";
import { groupLedger, mergeLedger } from "../../lib/insights";
import { toast } from "../../lib/toast";
import historyService from "../../services/historyService";
import styles from "./InsightsPage.module.css";

// How many entries are read at a time
const PAGE = 20;

const NOTHING_MORE = { entries: [], next: undefined };

/**
 * The XP ledger: every gain and every loss, newest first, under the day each belongs to, with the day's
 * net beside its name. A loss is the only thing here in the colour of a loss. Earlier entries are read
 * a page at a time.
 *
 * account: whose it is. today: "YYYY-MM-DD"
 * totalXp: the account's XP as it stands; when it changes, something has been written to the ledger
 */
const Ledger = ({ account, today, totalXp }) => {
    const first = useFetched(`ledger:${account}`, () => historyService.getLedger({ limit: PAGE }));
    // The pages read after the first, and where the next one starts
    const [more, setMore] = useState(NOTHING_MORE);
    const [reading, setReading] = useState(false);

    // Something was earned or lost while the screen was open: read the newest entries again
    const { retry } = first;
    const lastXp = useRef(totalXp);
    useEffect(() => {
        if (lastXp.current !== null && totalXp !== null && lastXp.current !== totalXp) retry();
        lastXp.current = totalXp;
    }, [totalXp, retry]);

    const groups = useMemo(
        () => groupLedger(mergeLedger(first.data?.entries ?? [], more.entries)),
        [first.data, more.entries],
    );
    const next = more.next !== undefined ? more.next : (first.data?.next ?? null);

    const readEarlier = async () => {
        setReading(true);
        try {
            const page = await historyService.getLedger({ before: next, limit: PAGE });
            setMore((held) => ({ entries: [...held.entries, ...page.entries], next: page.next }));
        } catch {
            toast.error("The earlier entries didn’t load.", { action: { label: "Try again", onClick: readEarlier } });
        } finally {
            setReading(false);
        }
    };

    return (
        <section className={styles.section} aria-label="XP ledger">
            <SectionHeader className={styles.head} title="XP ledger" />

            {first.status === "error" && (
                <ErrorState className={styles.inner} size="sm" title="The ledger didn’t load" onRetry={retry} />
            )}

            {first.status === "loading" && (
                <div aria-hidden="true">
                    {["14ch", "9ch", "17ch", "11ch"].map((width) => (
                        <div key={width} className={styles.entry}>
                            <Skeleton variant="text" width={width} />
                        </div>
                    ))}
                </div>
            )}

            {first.status === "ready" && groups.length === 0 && (
                <p className={styles.caption}>Nothing has been earned or lost yet.</p>
            )}

            {groups.map((group) => (
                <div key={group.date} className={styles.ledgerDay}>
                    <h3 className={styles.ledgerHead}>
                        <span>{ledgerDayLabel(group.date, today)}</span>
                        <span className={cx(styles.net, group.net < 0 && styles.loss)}>
                            {signedXp(group.net)}
                            <span className="visually-hidden"> XP</span>
                        </span>
                    </h3>
                    <ul>
                        {group.entries.map((entry) => {
                            const { label, note } = ledgerWords(entry);

                            return (
                                <li key={entry.id} className={styles.entry}>
                                    <span className={styles.what}>{label}</span>
                                    {note && <span className={styles.how}>{note}</span>}
                                    <span className={cx(styles.amount, entry.amount < 0 && styles.loss)}>
                                        {signedXp(entry.amount)}
                                        <span className="visually-hidden"> XP</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}

            {next && (
                <div className={styles.earlier}>
                    <Button size="sm" loading={reading} onClick={readEarlier}>
                        Show earlier
                    </Button>
                </div>
            )}
        </section>
    );
};

export default Ledger;
