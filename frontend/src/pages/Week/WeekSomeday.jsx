import { useState } from "react";
import WeekCard from "./WeekCard";
import { TodoAdd } from "../../components/todo";
import { Button } from "../../components/ui";
import { cx } from "../../lib/cx";
import { rowKey } from "../../lib/todos";
import { SOMEDAY_EMPTY } from "../../lib/weekWords";
import styles from "./WeekBoard.module.css";

// How many show before the rest wait behind "Show all"
const SHOWN = 12;

/**
 * Under the week: the to-dos on every list that have no day yet, ready to be carried onto one (or planned
 * from their menu), and a line to write one more on. A planned to-do carried here loses its day.
 *
 * todos: from buildWeek's someday. today. moveDays: the days they can be planned for from their menu
 * handle, carrying, over: from the page's useCarry
 * onCheck, onOpen, onPlan, onDelete: as WeekCard's. onAdd(title)
 */
const WeekSomeday = ({ todos, today, moveDays, handle, carrying, over, onCheck, onOpen, onPlan, onDelete, onAdd }) => {
    const [all, setAll] = useState(false);
    const shown = all ? todos : todos.slice(0, SHOWN);

    return (
        <section className={cx(styles.tray, over === "someday" && styles.over)} data-drop="someday" aria-labelledby="week-someday">
            <div className={styles.trayHead}>
                <h2 id="week-someday" className={styles.trayTitle}>
                    No day yet{todos.length > 0 ? ` · ${todos.length}` : ""}
                </h2>
                <p className={styles.trayNote}>Drag one onto a day, or use its menu.</p>
            </div>
            {todos.length === 0 ? (
                <p className={styles.quiet}>{SOMEDAY_EMPTY}</p>
            ) : (
                <ul className={styles.trayCards}>
                    {shown.map((todo) => (
                        <WeekCard
                            key={rowKey(todo)}
                            todo={todo}
                            today={today}
                            days={moveDays}
                            showDay
                            onCheck={onCheck}
                            onOpen={onOpen}
                            onPlan={onPlan}
                            onDelete={onDelete}
                            carry={handle(todo._id, todo)}
                            carrying={carrying?.id === todo._id ? carrying : null}
                        />
                    ))}
                </ul>
            )}
            {todos.length > SHOWN && (
                <Button size="sm" variant="ghost" className={styles.trayMore} onClick={() => setAll((current) => !current)}>
                    {all ? "Show fewer" : `Show all ${todos.length}`}
                </Button>
            )}
            <TodoAdd className={styles.add} placeholder="Add a to-do with no day" onAdd={onAdd} />
        </section>
    );
};

export default WeekSomeday;
