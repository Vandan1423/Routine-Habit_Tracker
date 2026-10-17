import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import SavedText from "./SavedText";
import useWeekRecord from "./useWeekRecord";
import WeekBoard from "./WeekBoard";
import WeekFocus from "./WeekFocus";
import WeekHours from "./WeekHours";
import WeekReview from "./WeekReview";
import WeekSomeday from "./WeekSomeday";
import WeekTracker from "./WeekTracker";
import Page from "../../components/shell/Page";
import { TodoPlanDialog } from "../../components/todo";
import {
    Button,
    Calendar,
    ErrorState,
    IconButton,
    Popover,
    SegmentedControl,
    Skeleton,
} from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useCarry from "../../hooks/useCarry";
import useFetched from "../../hooks/useFetched";
import useMediaQuery from "../../hooks/useMediaQuery";
import useNow from "../../hooks/useNow";
import usePlan from "../../hooks/usePlan";
import useRemembered from "../../hooks/useRemembered";
import useToday from "../../hooks/useToday";
import useTodos from "../../hooks/useTodos";
import { addDays, isDay, localDay, monthOf } from "../../lib/dates";
import { buildDay } from "../../lib/day";
import { WEEK_PATH, weekPath } from "../../lib/places";
import { fromMinutes, toMinutes } from "../../lib/time";
import { toast } from "../../lib/toast";
import { leftOverWords, moveToTodayWords, movedToWords } from "../../lib/todoWords";
import { firstDayOfWeek } from "../../lib/week";
import { buildWeek, nextWeekDay, trackerRows, unfinishedIn, weekStartOf } from "../../lib/weekPlan";
import { movedOnWords, NOTES_PLACEHOLDER, weekName, weekSummaryWords, weekTitle } from "../../lib/weekWords";
import goalService from "../../services/goalService";
import historyService from "../../services/historyService";
import todoService from "../../services/todoService";
import styles from "./WeekPage.module.css";

// The two ways a week is shown: as the pages of a planner, or hour by hour
const VIEWS = [
    { value: "days", label: "Days", icon: "plan" },
    { value: "hours", label: "Hours", icon: "clock" },
];

// The lists carry planned to-dos this many days back; a week further back reads its own (see the API)
const LISTS_CARRY_DAYS = 41;

// Going to another week: a month to pick any day of it from
const WeekJump = ({ start, today, onPick }) => {
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(monthOf(start));

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (next) setMonth(monthOf(start));
                setOpen(next);
            }}
            className={styles.jump}
            trigger={<IconButton icon="calendar" label="Go to a week" />}
        >
            <Calendar
                month={month}
                onMonthChange={setMonth}
                today={today}
                value={start}
                label="Go to the week of a day"
                onSelect={(day) => {
                    setOpen(false);
                    onPick(day);
                }}
            />
        </Popover>
    );
};

/**
 * Week: a week planned, day by day. What each day is for (the to-dos planned for it, which earn no XP and
 * cost none), what the plan asks of it and how that went, the week's focus and notes, what has no day yet,
 * a tracker of every routine and habit, and a look back at how the week went. The address names the
 * week by its first day (/week/2026-10-11); /week is the week today is in.
 */
const WeekPage = () => {
    const { start: asked } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const plan = usePlan();
    const today = useToday();
    const todos = useTodos();
    const now = useNow();
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const [firstDay] = useState(firstDayOfWeek);
    const [view, setView] = useRemembered(`week.view.${account}`, "days");
    const [planning, setPlanning] = useState(null);
    const [over, setOver] = useState(null);

    const { ensure: ensurePlan } = plan;
    const { ensure: ensureTodos } = todos;
    useEffect(() => {
        ensurePlan();
        ensureTodos();
    }, [ensurePlan, ensureTodos]);

    const date = today.date ?? localDay();
    const thisWeek = weekStartOf(date, firstDay);
    const start = asked && isDay(asked) ? weekStartOf(asked, firstDay) : thisWeek;
    const end = addDays(start, 6);
    const yesterday = addDays(date, -1);
    // The last day of this week that has ended, if any has
    const ended = start <= yesterday ? (end < yesterday ? end : yesterday) : null;

    const summaries = useFetched(ended ? `days:${account}:${start}:${ended}` : null, () =>
        historyService.getDays(start, ended),
    );
    const marked = useFetched(ended ? `marks:${account}:${start}:${ended}` : null, () =>
        historyService.getMarks(start, ended),
    );
    const older = useFetched(start < addDays(date, -LISTS_CARRY_DAYS) ? `planned:${account}:${start}` : null, () =>
        todoService.getPlanned(start, end),
    );
    const goals = useFetched(`goals:${account}`, goalService.getGoals);
    const record = useWeekRecord(start);

    const live = useMemo(
        () => buildDay({ routines: today.routines, habits: today.habits, pending: today.pending }),
        [today.routines, today.habits, today.pending],
    );
    const liveByKey = useMemo(() => new Map(live.items.map((item) => [item.key, item])), [live.items]);
    const marks = useMemo(
        () => new Map((marked.data?.marks ?? []).map((mark) => [`${mark.date}|${mark.kind}|${mark.id}`, mark])),
        [marked.data],
    );
    const week = useMemo(
        () =>
            buildWeek({
                start,
                today: date,
                lists: todos.lists,
                older: older.data ?? [],
                routines: plan.routines,
                habits: today.habits,
                summaries: summaries.data?.days ?? [],
                live: { total: live.total, done: live.done },
            }),
        [start, date, todos.lists, older.data, plan.routines, today.habits, summaries.data, live.total, live.done],
    );
    const rows = useMemo(() => trackerRows(week, { marks, live: liveByKey }), [week, marks, liveByKey]);

    // Where a to-do can be moved from its menu: the days of this week from today on, or today itself
    // when the week has gone by
    const moveDays = week.when === "past" ? [{ date }] : week.days.filter((day) => day.date >= date);

    const planTodo = (todo, planned) => todos.planTodo(todo, planned);
    const { handle, carrying } = useCarry({
        onOver: (place) => setOver(place?.dataset.drop ?? null),
        onDrop: ({ data: todo, place }) => {
            const target = place?.dataset.drop;
            if (!target) return;
            const next = target === "someday" ? null : target;
            if ((todo.date ?? null) === next) return;

            planTodo(todo, { date: next });
            toast(movedToWords(todo, next, date), { id: `week-moved-${todo._id}` });
        },
    });

    const ready = plan.status === "ready" && today.status === "ready" && todos.status === "ready";
    const failed = plan.status === "error" || today.status === "error" || todos.status === "error";

    // An address that names a day inside a week, or no day at all, is put right
    if (asked && (!isDay(asked) || asked !== start)) {
        return <Navigate to={isDay(asked) ? weekPath(start) : WEEK_PATH} replace />;
    }

    const goTo = (day) => {
        const first = weekStartOf(day, firstDay);
        navigate(first === thisWeek ? WEEK_PATH : weekPath(first));
    };

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>
                    {weekName(start, thisWeek)}
                    {ready ? ` · ${weekSummaryWords(week)}` : ""}
                </p>
                <h1 className={styles.title}>{weekTitle(start)}</h1>
            </div>
            <div className={styles.tools}>
                <div className={styles.nav}>
                    <IconButton icon="chevron-left" label="Previous week" onClick={() => goTo(addDays(start, -7))} />
                    {start !== thisWeek && (
                        <Button size="sm" onClick={() => navigate(WEEK_PATH)}>
                            This week
                        </Button>
                    )}
                    <IconButton icon="chevron-right" label="Next week" onClick={() => goTo(addDays(start, 7))} />
                    <WeekJump start={start} today={date} onPick={goTo} />
                </div>
                <SegmentedControl label="Show the week as" options={VIEWS} value={view} onChange={setView} iconOnly={isPhone} />
                {week.when !== "past" && (
                    <Button
                        variant="primary"
                        icon="plus"
                        onClick={() => setPlanning({ date: week.when === "current" ? date : start })}
                    >
                        To-do
                    </Button>
                )}
            </div>
        </header>
    );

    if (failed) {
        return (
            <Page>
                <div className={styles.page}>
                    {header}
                    <ErrorState
                        className={styles.state}
                        title="The week didn’t load"
                        onRetry={() => {
                            plan.retry();
                            todos.retry();
                        }}
                    />
                </div>
            </Page>
        );
    }

    if (!ready) {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading the week
                </p>
                <div className={styles.page} aria-hidden="true">
                    {header}
                    <div className={styles.loading}>
                        {Array.from({ length: 7 }, (_, index) => (
                            <div key={index}>
                                <Skeleton variant="text" width="60%" />
                                <Skeleton variant="text" width="85%" />
                            </div>
                        ))}
                    </div>
                </div>
            </Page>
        );
    }

    const cardActions = {
        onCheck: todos.setDone,
        onOpen: (todo) => setPlanning({ todo }),
        onPlan: planTodo,
        onDelete: todos.deleteTodo,
    };
    const carryProps = { handle, carrying, over, today: date, moveDays };
    const unfinished = unfinishedIn(week, date);

    const moveOn = () => {
        for (const todo of unfinished) planTodo(todo, { date: nextWeekDay(todo.date, date) });
        toast(movedOnWords(unfinished.length), { id: `week-moved-on-${start}` });
    };

    return (
        <Page>
            <div className={styles.page}>
                {header}

                {week.earlier.length > 0 && (
                    <div className={styles.earlier}>
                        <p>{leftOverWords(week.earlier.length)}</p>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => week.earlier.forEach((todo) => planTodo(todo, { date }))}
                        >
                            {moveToTodayWords(week.earlier.length)}
                        </Button>
                    </div>
                )}

                <div className={styles.top}>
                    <WeekFocus
                        focus={record.week.focus}
                        goals={(goals.data?.goals ?? []).filter((goal) => !goal.reachedAt)}
                        onSave={(focus) => record.save({ focus })}
                        onAdd={(title) => record.addFocus(title, record.week.focus)}
                    />
                    <section className={styles.notes} aria-labelledby="week-notes">
                        <h2 id="week-notes" className={styles.heading}>
                            Notes
                        </h2>
                        <SavedText
                            label={<span className="visually-hidden">Notes for the week</span>}
                            placeholder={NOTES_PLACEHOLDER}
                            rows={4}
                            value={record.week.notes}
                            onSave={(notes) => record.save({ notes })}
                        />
                    </section>
                </div>

                <div className={styles.days}>
                    {view === "hours" ? (
                        <WeekHours
                            week={week}
                            marks={marks}
                            live={liveByKey}
                            now={now}
                            onCreate={(day, time) =>
                                setPlanning({
                                    date: day,
                                    time,
                                    endTime: fromMinutes(Math.min(toMinutes(time) + 30, 23 * 60 + 45)),
                                })
                            }
                            onOpen={cardActions.onOpen}
                            onPlan={planTodo}
                        />
                    ) : (
                        <WeekBoard
                            days={week.days}
                            {...carryProps}
                            {...cardActions}
                            onAdd={(day, title) => todos.addTodo(title, undefined, { date: day })}
                        />
                    )}
                </div>

                <WeekSomeday
                    todos={week.someday}
                    {...carryProps}
                    {...cardActions}
                    onAdd={(title) => todos.addTodo(title)}
                />

                <WeekTracker rows={rows} days={week.days} />

                {week.when !== "ahead" && (
                    <WeekReview
                        week={week}
                        record={record.week}
                        onSave={record.save}
                        unfinished={unfinished}
                        onMoveOn={moveOn}
                    />
                )}
            </div>
            <TodoPlanDialog request={planning} onClose={() => setPlanning(null)} />
        </Page>
    );
};

export default WeekPage;
