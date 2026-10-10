import { NavLink } from "react-router-dom";
import { listPath } from "./todoPaths";
import { Icon } from "../../components/ui";
import { cx } from "../../lib/cx";
import { rowKeyOf } from "../../lib/drafts";
import { listLabel } from "../../lib/todos";
import styles from "./TodoLists.module.css";

/**
 * The lists there are, each with how much is still open on it, and the way to make another.
 *
 * lists: as GET /todos returns them. onNew(): a new list was asked for.
 * layout: "column" beside the list that is open, or "row" above it (where there is no room beside)
 */
const TodoLists = ({ lists, onNew, layout = "column" }) => (
    <nav className={cx(styles.lists, styles[layout])} aria-label="Lists">
        {layout === "column" && <h2 className={styles.heading}>Lists</h2>}
        <ul className={styles.items}>
            {lists.map((list) => {
                const open = list.todos.filter((todo) => !todo.done).length;

                return (
                    <li key={rowKeyOf(list._id)}>
                        {/* `end`: the general list lives at /todo, which every other list's address starts with */}
                        <NavLink to={listPath(list)} end className={styles.item}>
                            <span className={styles.name}>{listLabel(list)}</span>
                            <span className={styles.count}>
                                {open > 0 ? open : ""}
                                <span className="visually-hidden">{open > 0 ? " open" : "nothing open"}</span>
                            </span>
                        </NavLink>
                    </li>
                );
            })}
            <li>
                <button type="button" className={cx(styles.item, styles.new)} onClick={onNew}>
                    <Icon name="plus" size={14} />
                    <span className={styles.name}>New list</span>
                </button>
            </li>
        </ul>
    </nav>
);

export default TodoLists;
