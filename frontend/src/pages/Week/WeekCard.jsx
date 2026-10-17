import { Checkbox, IconButton, Menu } from "../../components/ui";
import { cx } from "../../lib/cx";
import { formatDayBrief } from "../../lib/dates";
import { formatTimeRange } from "../../lib/time";
import styles from "./WeekBoard.module.css";

/**
 * One to-do on the week: its box, its time where it has one, its words, and a menu that does everything a
 * carry does (and more) for the keyboard. Pressing its words opens it in full. It can be picked up and put
 * down on another day, or among those with no day.
 *
 * todo: as the API sends it. today: "YYYY-MM-DD"
 * days: the week's days that it could be moved to ([{ date }], today and after)
 * onCheck(todo, done), onOpen(todo), onPlan(todo, { date }), onDelete(todo)
 * carry: the props that let it be picked up (from useCarry), or none. carrying: { dx, dy } while it is.
 * showDay: says its day too (where it is not under one)
 */
const WeekCard = ({ todo, today, days, onCheck, onOpen, onPlan, onDelete, carry, carrying, showDay = false }) => {
    const left = Boolean(todo.date) && todo.date < today && !todo.done;
    const elsewhere = days.filter((day) => day.date !== todo.date);
    const time = todo.time ? formatTimeRange(todo.time, todo.endTime) : "";
    const when = [showDay && todo.date ? formatDayBrief(todo.date) : "", time].filter(Boolean).join(", ");

    return (
        <li
            className={cx(styles.card, todo.done && styles.done, left && styles.left, carrying && styles.carried)}
            style={carrying ? { "--dx": `${carrying.dx}px`, "--dy": `${carrying.dy}px` } : undefined}
            data-item={`todo:${todo._id}`}
            {...carry}
        >
            <span className={styles.check} data-no-carry="">
                <Checkbox
                    checked={todo.done}
                    onChange={(event) => onCheck(todo, event.target.checked)}
                    aria-label={todo.title}
                />
            </span>
            <button type="button" className={styles.cardMain} onClick={() => onOpen(todo)}>
                {when && <span className={styles.cardTime}>{when}</span>}
                <span className={styles.cardTitle}>{todo.title}</span>
                {left && <span className={styles.cardLeft}>Not done</span>}
                {showDay && todo.listLabel && !todo.date && <span className={styles.cardTime}>{todo.listLabel}</span>}
            </button>
            <span className={styles.cardMenu}>
                <Menu
                    align="end"
                    trigger={<IconButton icon="more" size="sm" label={`Options for ${todo.title}`} data-no-carry="" />}
                >
                    {left && (
                        <Menu.Item icon="arrow-right" onSelect={() => onPlan(todo, { date: today })}>
                            Move to today
                        </Menu.Item>
                    )}
                    {elsewhere.length > 0 && (
                        <Menu.Group label="Move to">
                            {elsewhere.map((day) => (
                                <Menu.Item key={day.date} onSelect={() => onPlan(todo, { date: day.date })}>
                                    {day.date === today ? "Today" : formatDayBrief(day.date)}
                                </Menu.Item>
                            ))}
                            {todo.date && (
                                <Menu.Item onSelect={() => onPlan(todo, { date: null })}>No day</Menu.Item>
                            )}
                        </Menu.Group>
                    )}
                    <Menu.Separator />
                    <Menu.Item icon="edit" onSelect={() => onOpen(todo)}>
                        Edit…
                    </Menu.Item>
                    <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(todo)}>
                        Delete
                    </Menu.Item>
                </Menu>
            </span>
        </li>
    );
};

export default WeekCard;
