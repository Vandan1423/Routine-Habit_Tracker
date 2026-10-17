import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TodoAdd } from "../../components/todo";
import { Checkbox, IconButton, Menu } from "../../components/ui";
import { cx } from "../../lib/cx";
import { GOALS_PATH } from "../../lib/places";
import { FOCUS_HINT, FOCUS_PLACEHOLDER } from "../../lib/weekWords";
import styles from "./WeekPage.module.css";

// A week focuses on a few things, as week planners keep it
const MOST_FOCUS = 5;

// One line of the focus: its box, its words (pressed, they become a field), the goal it moves along
const FocusLine = ({ entry, goals, onChange, onRemove }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(entry.title);
    const field = useRef(null);
    const goal = goals.find((candidate) => candidate._id === entry.goal);

    useEffect(() => {
        if (editing) field.current?.select();
    }, [editing]);

    const keep = () => {
        setEditing(false);
        const title = draft.trim();
        if (title && title !== entry.title) onChange({ title });
    };

    return (
        <li className={cx(styles.focusLine, entry.done && styles.focusDone)}>
            <Checkbox checked={entry.done} onChange={(event) => onChange({ done: event.target.checked })} aria-label={entry.title} />
            <div className={styles.focusMain}>
                {editing ? (
                    <input
                        ref={field}
                        className={styles.focusField}
                        value={draft}
                        maxLength={120}
                        aria-label={`Reword ${entry.title}`}
                        autoComplete="off"
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={keep}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") keep();
                            if (event.key === "Escape") {
                                event.stopPropagation();
                                setEditing(false);
                            }
                        }}
                    />
                ) : (
                    <button
                        type="button"
                        className={styles.focusTitle}
                        onClick={() => {
                            setDraft(entry.title);
                            setEditing(true);
                        }}
                    >
                        <span className="visually-hidden">Reword: </span>
                        {entry.title}
                    </button>
                )}
                {goal && (
                    <Link to={GOALS_PATH} className={styles.focusGoal}>
                        Towards {goal.title}
                    </Link>
                )}
            </div>
            <span className={styles.focusMenu}>
                <Menu align="end" trigger={<IconButton icon="more" size="sm" label={`Options for ${entry.title}`} />}>
                    {goals.length > 0 && (
                        <Menu.RadioGroup
                            label="Towards a goal"
                            value={entry.goal ?? "none"}
                            onChange={(value) => onChange({ goal: value === "none" ? null : value })}
                        >
                            <Menu.RadioItem value="none">No goal</Menu.RadioItem>
                            {goals.map((candidate) => (
                                <Menu.RadioItem key={candidate._id} value={candidate._id}>
                                    {candidate.title}
                                </Menu.RadioItem>
                            ))}
                        </Menu.RadioGroup>
                    )}
                    {goals.length > 0 && <Menu.Separator />}
                    <Menu.Item icon="trash" tone="danger" onSelect={onRemove}>
                        Remove
                    </Menu.Item>
                </Menu>
            </span>
        </li>
    );
};

/**
 * What the week is for: up to five things, each ticked when it is reached, and each may be tied to one
 * of the goals still being worked towards. Earns no XP.
 * focus: [{ _id, title, done, goal }]. goals: the goals to choose from ([{ _id, title }]).
 * onSave(focus): the whole list as it stands now. onAdd(title)
 */
const WeekFocus = ({ focus, goals, onSave, onAdd }) => (
    <section className={styles.focus} aria-labelledby="week-focus">
        <h2 id="week-focus" className={styles.heading}>
            Focus
        </h2>
        {focus.length === 0 && <p className={styles.hint}>{FOCUS_HINT}</p>}
        <ul className={styles.focusLines}>
            {focus.map((entry) => (
                <FocusLine
                    key={entry._id}
                    entry={entry}
                    goals={goals}
                    onChange={(change) => onSave(focus.map((line) => (line._id === entry._id ? { ...line, ...change } : line)))}
                    onRemove={() => onSave(focus.filter((line) => line._id !== entry._id))}
                />
            ))}
        </ul>
        {focus.length < MOST_FOCUS && (
            <TodoAdd className={styles.focusAdd} placeholder={FOCUS_PLACEHOLDER} label={FOCUS_PLACEHOLDER} onAdd={onAdd} />
        )}
    </section>
);

export default WeekFocus;
