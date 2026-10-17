import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import Checkbox from "../ui/Checkbox";
import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import { cx } from "../../lib/cx";
import { KEYS } from "../../lib/shortcuts";
import { listLabel } from "../../lib/todos";
import { TODO_MAX } from "../../lib/todoWords";
import styles from "./TodoRow.module.css";

/**
 * One to-do: the check that finishes it, its words, and what else can be done with it.
 * Pressing its words (or E with the row focused) turns them into a field; Enter keeps the change, Esc drops it.
 * It comes into the list, and leaves it, by its own height.
 *
 * todo: as the API sends it
 * lists: every list, for "Move to". With fewer than two there is nowhere to move it.
 * onCheck(todo, done), onRename(todo, title), onMove(todo, listId), onDelete(todo)
 * meta: a few words beside its own, such as the day and time it is planned for. metaTone: "late" for a day gone by.
 * actions: more that can be done with it, first in its menu: [{ label, icon, onSelect }]
 * still: drawn without the arriving and leaving (for a list that is replaced whole)
 */
const TodoRow = ({
    todo,
    lists = [],
    onCheck,
    onRename,
    onMove,
    onDelete,
    meta,
    metaTone,
    actions = [],
    still = false,
}) => {
    const isPresent = useIsPresent();
    // Clipped while it grows in or shrinks away, so its words do not spill out of a row too short to hold them
    const [resizing, setResizing] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(todo.title);
    const field = useRef(null);
    const elsewhere = lists.filter((list) => list._id !== todo.list);

    useEffect(() => {
        if (editing) field.current?.select();
    }, [editing]);

    const edit = () => {
        setDraft(todo.title);
        setEditing(true);
    };

    // Kept if it says something new; an empty field leaves the to-do as it was
    const keep = () => {
        const title = draft.trim();
        setEditing(false);
        if (title && title !== todo.title) onRename(todo, title);
    };

    return (
        <m.li
            className={cx(styles.frame, (resizing || !isPresent) && styles.clipped)}
            initial={still ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onAnimationStart={() => setResizing(true)}
            onAnimationComplete={() => setResizing(false)}
        >
            <div className={cx(styles.row, todo.done && styles.done)} data-item={`todo:${todo._id}`}>
                <Checkbox
                    checked={todo.done}
                    onChange={(event) => onCheck(todo, event.target.checked)}
                    aria-label={todo.title}
                />
                <div className={styles.main}>
                    {editing ? (
                        <input
                            ref={field}
                            className={styles.field}
                            value={draft}
                            maxLength={TODO_MAX}
                            aria-label={`Reword ${todo.title}`}
                            autoComplete="off"
                            enterKeyHint="done"
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={keep}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") keep();
                                if (event.key === "Escape") {
                                    // Esc here is for the field alone: nothing behind it should close
                                    event.stopPropagation();
                                    setEditing(false);
                                }
                            }}
                        />
                    ) : (
                        <button type="button" className={styles.title} data-edit="" onClick={edit}>
                            <span className="visually-hidden">Reword: </span>
                            {todo.title}
                        </button>
                    )}
                    {meta && !editing && <span className={cx(styles.meta, metaTone && styles[metaTone])}>{meta}</span>}
                </div>
                <span className={styles.menu}>
                    <Menu
                        align="end"
                        trigger={<IconButton icon="more" size="sm" label={`Options for ${todo.title}`} />}
                    >
                        {actions.map((action) => (
                            <Menu.Item key={action.label} icon={action.icon} onSelect={action.onSelect}>
                                {action.label}
                            </Menu.Item>
                        ))}
                        {actions.length > 0 && <Menu.Separator />}
                        <Menu.Item icon="edit" shortcut={KEYS.edit} onSelect={edit}>
                            Reword
                        </Menu.Item>
                        {elsewhere.length > 0 && (
                            <>
                                <Menu.Separator />
                                <Menu.Group label="Move to">
                                    {elsewhere.map((list) => (
                                        <Menu.Item key={list._id} onSelect={() => onMove(todo, list._id)}>
                                            {listLabel(list)}
                                        </Menu.Item>
                                    ))}
                                </Menu.Group>
                            </>
                        )}
                        <Menu.Separator />
                        <Menu.Item
                            icon="trash"
                            tone="danger"
                            shortcut={KEYS.remove}
                            data-delete=""
                            onSelect={() => onDelete(todo)}
                        >
                            Delete
                        </Menu.Item>
                    </Menu>
                </span>
            </div>
        </m.li>
    );
};

export default TodoRow;
