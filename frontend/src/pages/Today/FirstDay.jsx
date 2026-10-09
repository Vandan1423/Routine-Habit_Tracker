import { useId, useMemo, useState } from "react";
import { DayStrip } from "../../components/day";
import { Button, Icon, Kbd, SectionHeader } from "../../components/ui";
import { cx } from "../../lib/cx";
import { detailWords } from "../../lib/itemWords";
import { KEYS } from "../../lib/shortcuts";
import {
    PASSED_WORDS,
    STARTERS_LEAD,
    STARTERS_TITLE,
    buildStarters,
    stakesOfStarters,
    startWords,
} from "../../lib/starters";
import styles from "./FirstDay.module.css";

const xpFormat = new Intl.NumberFormat();

// The strip before anything is chosen: the app's sign for "nothing here yet"
const BLANK_SEGMENTS = 8;

// One starter: a line of the day it would become, pressed to take it and pressed again to leave it
const StarterRow = ({ item, disabled, onToggle }) => {
    const detail = detailWords(item);

    return (
        <li>
            <button
                type="button"
                className={cx(styles.row, item.chosen && styles.chosen)}
                aria-pressed={item.chosen}
                aria-disabled={disabled || undefined}
                onClick={() => {
                    if (!disabled) onToggle(item.id);
                }}
            >
                <span className={styles.mark}>
                    <Icon name={item.chosen ? "check" : "plus"} />
                </span>
                <span className={styles.main}>
                    <span className={styles.name}>{item.title}</span>
                    {(detail || item.passed) && (
                        <span className={styles.meta}>
                            {detail}
                            {item.passed && ` · ${PASSED_WORDS}`}
                        </span>
                    )}
                </span>
                <span className={styles.xp}>
                    +{xpFormat.format(item.worth)}
                    <span className="visually-hidden"> XP</span>
                </span>
            </button>
        </li>
    );
};

/**
 * What a brand-new account finds where its day will be: a few routines and habits to begin with, laid out
 * as the day they would make. Each one chosen adds its segment to the strip above, so the day can be seen
 * taking shape before anything is saved. What choosing costs is stated before the button, not after.
 *
 * now: the moment the day is being built for
 * busy: the chosen ones are being saved
 * onStart(starters): make these
 * onSkip(): the person would rather add their own
 */
const FirstDay = ({ now, busy = false, onStart, onSkip }) => {
    const titleId = useId();
    const [chosen, setChosen] = useState([]);

    const starters = useMemo(() => buildStarters(chosen, now), [chosen, now]);
    const stakes = stakesOfStarters(starters);

    const toggle = (id) =>
        setChosen((current) =>
            current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
        );

    const start = () => {
        const mine = starters.offered
            .flatMap((block) => block.items)
            .filter((item) => item.chosen)
            .map((item) => item.starter);

        if (mine.length > 0) onStart(mine);
    };

    return (
        <section className={styles.first} aria-labelledby={titleId}>
            <h2 id={titleId} className={styles.title}>
                {STARTERS_TITLE}
            </h2>
            <p className={styles.lead}>{STARTERS_LEAD}</p>

            {starters.count > 0 ? (
                <DayStrip blocks={starters.day.blocks} className={styles.strip} />
            ) : (
                <span className={cx(styles.strip, styles.blank)} aria-hidden="true">
                    {Array.from({ length: BLANK_SEGMENTS }, (_, index) => (
                        <i key={index} />
                    ))}
                </span>
            )}

            {starters.offered.map((block) => {
                const taken = block.items.filter((item) => item.chosen).length;

                return (
                    <section key={block.id} className={styles.block} aria-label={block.label}>
                        <SectionHeader
                            as="h3"
                            className={styles.head}
                            title={block.label}
                            current={taken > 0}
                            meta={taken > 0 ? `${taken} chosen` : null}
                        />
                        <ul className={styles.rows}>
                            {block.items.map((item) => (
                                <StarterRow key={item.key} item={item} disabled={busy} onToggle={toggle} />
                            ))}
                        </ul>
                    </section>
                );
            })}

            <div className={styles.foot}>
                {/* Read out as it changes: it is what choosing these means */}
                <p className={styles.stakes} aria-live="polite">
                    <b>{stakes.lead}</b> {stakes.rest}
                </p>
                <div className={styles.actions}>
                    <Button
                        variant="primary"
                        size="lg"
                        loading={busy}
                        disabled={starters.count === 0}
                        onClick={start}
                    >
                        {startWords(starters.count)}
                    </Button>
                    <Button variant="ghost" size="lg" disabled={busy} onClick={onSkip}>
                        I’ll add my own
                    </Button>
                </div>
                <p className={styles.keys}>
                    Later, <Kbd keys={KEYS.menu} /> opens a menu that goes anywhere and adds anything.
                </p>
            </div>
        </section>
    );
};

export default FirstDay;
