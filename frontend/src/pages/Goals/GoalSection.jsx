import { useId } from "react";
import { Link } from "react-router-dom";
import { MiniStrip } from "../../components/day";
import { Button, Checkbox, IconButton, Menu } from "../../components/ui";
import { cx } from "../../lib/cx";
import { ALL_DONE_WORDS, dateWords, keptWords, stepsWords } from "../../lib/goalWords";
import styles from "./GoalsPage.module.css";

/**
 * One goal: what it is and by when, how far along its milestones are (drawn as a strip, a mark for each),
 * the milestones themselves to tick, and how the routines and habits that carry it have been kept.
 *
 * goal: from layoutGoal (lib/goals.js)
 * onTick(goal, milestone, done), onEdit(goal), onReach(goal, reached), onDelete(goal)
 */
const GoalSection = ({ goal, onTick, onEdit, onReach, onDelete }) => {
    const headingId = useId();
    const when = dateWords(goal);
    const steps = stepsWords(goal.steps);

    return (
        <section className={cx(styles.goal, goal.reached && styles.reached)} aria-labelledby={headingId}>
            <header className={styles.goalHead}>
                <div className={styles.goalText}>
                    <h2 id={headingId} className={styles.goalTitle}>
                        {goal.title}
                    </h2>
                    {(when || steps) && (
                        <p className={styles.goalMeta}>
                            {when && <span className={when.late ? styles.late : undefined}>{when.text}</span>}
                            {when && steps && " · "}
                            {steps}
                        </p>
                    )}
                </div>
                <Menu align="end" trigger={<IconButton icon="more" label={`Options for ${goal.title}`} />}>
                    <Menu.Item icon="edit" onSelect={() => onEdit(goal)}>
                        Edit
                    </Menu.Item>
                    <Menu.Item icon={goal.reached ? "undo" : "check"} onSelect={() => onReach(goal, !goal.reached)}>
                        {goal.reached ? "Open it again" : "Mark as reached"}
                    </Menu.Item>
                    <Menu.Separator />
                    <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(goal)}>
                        Delete
                    </Menu.Item>
                </Menu>
            </header>

            {goal.note && <p className={styles.note}>{goal.note}</p>}

            {goal.steps.total > 0 && (
                <>
                    <MiniStrip className={styles.strip} total={goal.steps.total} done={goal.steps.done} />
                    <ul className={styles.milestones}>
                        {goal.milestones.map((milestone) => (
                            <li key={milestone.id} className={cx(styles.milestone, milestone.done && styles.done)}>
                                <Checkbox
                                    className={styles.check}
                                    checked={milestone.done}
                                    onChange={(event) => onTick(goal, milestone, event.target.checked)}
                                    label={milestone.title}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {goal.allDone && !goal.reached && (
                <p className={styles.arrived}>
                    {ALL_DONE_WORDS}
                    <Button size="sm" onClick={() => onReach(goal, true)}>
                        Mark as reached
                    </Button>
                </p>
            )}

            {goal.links.length > 0 && (
                <div className={styles.carried}>
                    <h3 className={styles.carriedHead}>Carried by</h3>
                    <ul>
                        {goal.links.map((link) => (
                            <li key={`${link.kind}:${link.id}`} className={styles.link}>
                                {link.active ? (
                                    <Link to={`/plan/${link.kind}/${link.id}`} className={styles.linkName}>
                                        {link.title}
                                    </Link>
                                ) : (
                                    <span className={cx(styles.linkName, styles.gone)}>{link.title}</span>
                                )}
                                <span className={styles.kept}>{keptWords(link)}</span>
                                {link.kept && (
                                    <MiniStrip
                                        className={styles.keptStrip}
                                        total={link.kept.due}
                                        done={link.kept.done}
                                        whole
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default GoalSection;
