import { Link } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { TodoAdd, TodoRow } from "../../components/todo";
import { SectionHeader } from "../../components/ui";
import useTodos from "../../hooks/useTodos";
import { TODO_PATH } from "../../lib/places";
import { rowKey, todayTodos } from "../../lib/todos";
import { moreOnListWords } from "../../lib/todoWords";
import styles from "./TodayPage.module.css";

/**
 * The general to-do list, ahead of the day's own parts: what is still open on it and what was ticked
 * today, with a line to write the next one on. It is an extra: until the lists have arrived, and if
 * they never do, the day is shown without it. (TodayPage holds the day back a moment for them, so the
 * day is not pushed down the page when they come.)
 * now: the moment the screen is showing
 */
const TodayTodos = ({ now }) => {
    // TodayPage asks for the lists, alongside the day
    const { status, lists, addTodo, setDone, renameTodo, moveTodo, deleteTodo } = useTodos();

    if (status !== "ready") return null;

    const view = todayTodos(lists, { now });

    return (
        <section className={styles.todos} aria-label="To-do">
            <SectionHeader
                className={styles.todosHead}
                title="To-do"
                meta={view.open > 0 ? String(view.open) : undefined}
            />
            <ul className={styles.todoRows}>
                <AnimatePresence initial={false}>
                    {view.rows.map((todo) => (
                        <TodoRow
                            key={rowKey(todo)}
                            todo={todo}
                            lists={lists}
                            onCheck={setDone}
                            onRename={renameTodo}
                            onMove={moveTodo}
                            onDelete={deleteTodo}
                        />
                    ))}
                </AnimatePresence>
            </ul>
            <TodoAdd onAdd={(title) => addTodo(title)} />
            {view.more > 0 && (
                <p className={styles.more}>
                    <Link to={TODO_PATH} className={styles.textLink}>
                        {moreOnListWords(view.more)}
                    </Link>
                </p>
            )}
        </section>
    );
};

export default TodayTodos;
