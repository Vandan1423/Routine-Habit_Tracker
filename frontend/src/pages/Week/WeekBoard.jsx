import { Link } from "react-router-dom";
import WeekCard from "./WeekCard";
import { MiniStrip } from "../../components/day";
import { TodoAdd } from "../../components/todo";
import { cx } from "../../lib/cx";
import { formatDayPlain } from "../../lib/dates";
import { rowKey } from "../../lib/todos";
import { weekdayName } from "../../lib/week";
import { dayStandingWords } from "../../lib/weekWords";
import styles from "./WeekBoard.module.css";

// Where a day's line about the plan leads: a day that has ended to its page in History, today to Today
const dayLink = (day) => (day.when === "past" ? `/history/${day.date}` : day.when === "today" ? "/today" : null);

/**
 * The week as a paper planner: a column for each day, with what the plan asks of it said under its name
 * and the to-dos planned for it below, and a line at the foot of each day still to come to write the next
 * one on. A to-do can be carried from one day to another. A day that has gone by keeps what was planned
 * for it, done or not; nothing moves on by itself.
 *
 * days: from buildWeek. today: "YYYY-MM-DD"
 * moveDays: the days a to-do can be moved to from its menu
 * handle(id, todo), carrying, over: from the page's useCarry, and the day a carried card is over
 * onCheck, onOpen, onPlan, onDelete: as WeekCard's. onAdd(date, title): resolves once it is saved.
 */
const WeekBoard = ({ days, today, moveDays, handle, carrying, over, onCheck, onOpen, onPlan, onDelete, onAdd }) => (
    <div className={styles.frame}>
    <div className={styles.board}>
        {days.map((day) => {
            const link = dayLink(day);
            const strip = (
                <>
                    <MiniStrip total={day.standing.total} done={day.standing.done} settled={day.when === "past"} />
                    <span>{dayStandingWords(day)}</span>
                </>
            );

            return (
                <section
                    key={day.date}
                    className={cx(
                        styles.day,
                        day.when === "today" && styles.today,
                        day.when === "past" && styles.past,
                        over === day.date && styles.over,
                    )}
                    data-drop={day.when === "past" ? undefined : day.date}
                    aria-label={`${formatDayPlain(day.date)}${day.when === "today" ? ", today" : ""}`}
                >
                    <header className={styles.dayHead}>
                        <h3 className={styles.dayName}>
                            <span className={styles.weekday}>{weekdayName(day.day)}</span>
                            <span className={styles.number}>{Number(day.date.slice(8))}</span>
                        </h3>
                        {link ? (
                            <Link to={link} className={styles.standing}>
                                {strip}
                            </Link>
                        ) : (
                            <span className={styles.standing}>{strip}</span>
                        )}
                    </header>

                    <ul className={styles.cards}>
                        {day.todos.map((todo) => (
                            <WeekCard
                                key={rowKey(todo)}
                                todo={todo}
                                today={today}
                                days={moveDays}
                                onCheck={onCheck}
                                onOpen={onOpen}
                                onPlan={onPlan}
                                onDelete={onDelete}
                                carry={handle(todo._id, todo)}
                                carrying={carrying?.id === todo._id ? carrying : null}
                            />
                        ))}
                    </ul>

                    {day.when !== "past" && (
                        <TodoAdd
                            className={styles.add}
                            placeholder="Add"
                            label={`Add a to-do to ${formatDayPlain(day.date)}`}
                            onAdd={(title) => onAdd(day.date, title)}
                        />
                    )}
                    {day.when === "past" && day.todos.length === 0 && <p className={styles.quiet}>Nothing was planned.</p>}
                </section>
            );
        })}
    </div>
    </div>
);

export default WeekBoard;
