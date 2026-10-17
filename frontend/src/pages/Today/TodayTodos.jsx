import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { TodoAdd, TodoPlanDialog, TodoRow } from "../../components/todo";
import { Button, SectionHeader } from "../../components/ui";
import useToday from "../../hooks/useToday";
import useTodos from "../../hooks/useTodos";
import { localDay } from "../../lib/dates";
import { TODO_PATH, WEEK_PATH } from "../../lib/places";
import { rowKey, todayTodos } from "../../lib/todos";
import {
    leftOverWords,
    moreEarlierWords,
    moreOnListWords,
    moveToTodayWords,
    plannedWords,
} from "../../lib/todoWords";
import styles from "./TodayPage.module.css";

// What is shown of what was left from earlier days before the rest wait on Week
const EARLIER_SHOWN = 3;

/**
 * The to-dos, ahead of the day's own parts: what is planned for today (from Week), what was planned for an
 * earlier day and is still not done (it stays on its day until it is moved, and can be brought here, one at
 * a time or all at once), and the general list's own, with a line to write the next one on. It is an extra:
 * until the lists have arrived, and if they never do, the day is shown without it. (TodayPage holds the day
 * back a moment for them, so the day is not pushed down the page when they come.)
 * now: the moment the screen is showing
 */
const TodayTodos = ({ now }) => {
    // TodayPage asks for the lists, alongside the day
    const { status, lists, addTodo, setDone, renameTodo, moveTodo, planTodo, deleteTodo } = useTodos();
    const { date } = useToday();
    const [planning, setPlanning] = useState(null);

    if (status !== "ready") return null;

    const today = date ?? localDay(now);
    const view = todayTodos(lists, { now, today });
    const earlier = view.earlier.slice(0, EARLIER_SHOWN);
    const toToday = (todo) => planTodo(todo, { date: today });

    const row = (todo, { meta, tone, actions = [] } = {}) => (
        <TodoRow
            key={rowKey(todo)}
            todo={todo}
            lists={lists}
            onCheck={setDone}
            onRename={renameTodo}
            onMove={moveTodo}
            onDelete={deleteTodo}
            meta={meta}
            metaTone={tone}
            actions={[...actions, { label: "Plan for a day…", icon: "calendar", onSelect: () => setPlanning({ todo }) }]}
        />
    );

    return (
        <section className={styles.todos} aria-label="To-do">
            <SectionHeader
                className={styles.todosHead}
                title="To-do"
                meta={view.open > 0 ? String(view.open) : undefined}
            />

            {view.earlier.length > 0 && (
                <div className={styles.earlier}>
                    <p>{leftOverWords(view.earlier.length)}</p>
                    <Button size="sm" variant="ghost" onClick={() => view.earlier.forEach(toToday)}>
                        {moveToTodayWords(view.earlier.length)}
                    </Button>
                </div>
            )}
            <ul className={styles.todoRows}>
                <AnimatePresence initial={false}>
                    {earlier.map((todo) =>
                        row(todo, {
                            meta: plannedWords(todo, today),
                            tone: "late",
                            actions: [{ label: "Move to today", icon: "arrow-right", onSelect: () => toToday(todo) }],
                        }),
                    )}
                    {view.planned.map((todo) => row(todo, { meta: plannedWords(todo, today, { withDay: false }) }))}
                    {view.rows.map((todo) => row(todo))}
                </AnimatePresence>
            </ul>
            {view.earlier.length > EARLIER_SHOWN && (
                <p className={styles.more}>
                    <Link to={WEEK_PATH} className={styles.textLink}>
                        {moreEarlierWords(view.earlier.length - EARLIER_SHOWN)}
                    </Link>
                </p>
            )}
            <TodoAdd onAdd={(title) => addTodo(title)} />
            {view.more > 0 && (
                <p className={styles.more}>
                    <Link to={TODO_PATH} className={styles.textLink}>
                        {moreOnListWords(view.more)}
                    </Link>
                </p>
            )}
            <TodoPlanDialog request={planning} onClose={() => setPlanning(null)} />
        </section>
    );
};

export default TodayTodos;
