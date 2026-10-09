import { Link } from "react-router-dom";
import { MiniStrip } from "../../components/day";
import { ErrorState, SectionHeader } from "../../components/ui";
import { keptWords, leftWords, namelessWords, signedXp } from "../../lib/historyWords";
import { itemPath } from "../Plan/planPaths";
import styles from "./InsightsPage.module.css";

// One routine or habit: its name (leading to its own page while it is still in the plan), its days
// as one short strip, and the count in words
const RankRow = ({ item, children }) => {
    const title = item.title ?? namelessWords(item.kind);

    return (
        <li className={styles.rankRow} data-item={item.key}>
            {item.active ? (
                <Link to={itemPath(item)} className={styles.name}>
                    {title}
                </Link>
            ) : (
                <span className={styles.name}>{title}</span>
            )}
            <span className={styles.said}>{children}</span>
            <MiniStrip className={styles.days} total={item.due} done={item.done} settled whole />
        </li>
    );
};

/**
 * Which routines and habits were kept most over the last four weeks, and which were left most often,
 * with what leaving them cost.
 *
 * ranks: { kept, left } from rankItems (lib/insights.js)
 * status: of the request they came from; onRetry asks again
 */
const ItemRanks = ({ ranks, status, onRetry }) => {
    if (status === "loading") return null;

    if (status === "error") {
        return (
            <section className={styles.section}>
                <SectionHeader className={styles.head} title="Routines and habits" />
                <ErrorState
                    className={styles.inner}
                    size="sm"
                    title="How each one went didn’t load"
                    onRetry={onRetry}
                />
            </section>
        );
    }

    if (ranks.kept.length === 0 && ranks.left.length === 0) return null;

    return (
        <section className={styles.section} aria-label="Routines and habits">
            <SectionHeader className={styles.head} title="Routines and habits" meta="The last 4 weeks" />
            <div className={styles.ranks}>
                {ranks.kept.length > 0 && (
                    <div>
                        <h3 className={styles.subheading}>Kept most</h3>
                        <ul>
                            {ranks.kept.map((item) => (
                                <RankRow key={item.key} item={item}>
                                    {keptWords(item)}
                                </RankRow>
                            ))}
                        </ul>
                    </div>
                )}
                {ranks.left.length > 0 && (
                    <div>
                        <h3 className={styles.subheading}>Left most often</h3>
                        <ul>
                            {ranks.left.map((item) => (
                                <RankRow key={item.key} item={item}>
                                    {leftWords(item)}
                                    {item.xpLost > 0 && (
                                        <>
                                            {" · "}
                                            <span className={styles.loss}>
                                                {signedXp(-item.xpLost)}
                                                <span className="visually-hidden"> XP</span>
                                            </span>
                                        </>
                                    )}
                                </RankRow>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ItemRanks;
