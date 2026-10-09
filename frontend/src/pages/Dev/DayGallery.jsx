import { useMemo, useState } from "react";
import {
    DayBlock,
    DayHeader,
    DayLayout,
    DayProgress,
    DayRecap,
    DaySkeleton,
    DayTotal,
    MiniStrip,
    WeekAside,
} from "../../components/day";
import {
    Button,
    Calendar,
    CheckMark,
    ConfirmDialog,
    Fact,
    Facts,
    Stepper,
    Switch,
} from "../../components/ui";
import { addDays, formatDayTitle } from "../../lib/dates";
import {
    buildDay,
    expectedRoutineLog,
    firstRoutineOf,
    minutesOf,
    stepQuantity,
    tallyOf,
} from "../../lib/day";
import {
    completionWords,
    dayMessage,
    greetingAt,
    levelWords,
    reopenWords,
    STREAK_MILESTONES,
    tomorrowWords,
} from "../../lib/dayMessage";
import { buildMonth, buildPastDay } from "../../lib/history";
import { calendarDayWords, pastDayWords, pastTotalLabel, signedXp, unnamedWords } from "../../lib/historyWords";
import { buildRecap } from "../../lib/recap";
import { toast } from "../../lib/toast";
import MilestoneDialog from "../../components/day/MilestoneDialog";
import useDayFolds from "../Today/useDayFolds";
import { Row, Section } from "./GalleryParts";
import styles from "./GalleryPage.module.css";

// The fourth part of the gallery: the pieces a day is drawn from, on a made-up day that never changes.
// The clock is held at 1:35 in the afternoon, so every state a row can be in is on show at once.
// Nothing here waits for a server, so a block or the day is sealed the moment its last item is ticked.

const DATE = "2026-10-09";
const NOW = new Date(2026, 9, 9, 13, 35);

const ROUTINES = [
    { _id: "wake", title: "Wake up and water", startTime: "06:30", xpReward: 10, todayLog: { wasOnTime: true, xpEarned: 10 } },
    { _id: "workout", title: "Workout", startTime: "07:00", endTime: "07:45", xpReward: 10, todayLog: { wasOnTime: false, xpEarned: 5 } },
    { _id: "inbox", title: "Clear the inbox", startTime: "13:00", endTime: "13:10", xpReward: 10, todayLog: null },
    { _id: "deep", title: "Deep work", startTime: "14:00", endTime: "16:00", xpReward: 10, todayLog: null },
    { _id: "cook", title: "Cook dinner for everyone who said they were coming, and the two who did not say", startTime: "19:30", xpReward: 10, todayLog: null },
    { _id: "plan", title: "Plan tomorrow", startTime: "22:00", xpReward: 10, todayLog: null },
];

// A day that has ended, as GET /history/days/:date answers it: something of every kind a line can be
const PAST = {
    date: "2026-10-03",
    summary: { date: "2026-10-03", totalRoutines: 4, completedRoutines: 3, totalHabits: 4, completedHabits: 1, isPerfectDay: false, xpNet: 7, xpLost: 18 },
    items: [
        { kind: "routine", id: "wake", title: "Wake up and water", active: true, startTime: "06:30", endTime: "", status: "done", completedAt: "06:40", xpEarned: 10 },
        { kind: "routine", id: "workout", title: "Workout", active: true, startTime: "07:00", endTime: "07:45", status: "late", completedAt: "09:10", xpEarned: 5 },
        { kind: "habit", id: "meditate", title: "Meditation", active: true, timeOfDay: "morning", counted: false, target: 1, unit: "", status: "done", quantity: 1, xpEarned: 15 },
        { kind: "routine", id: "cook", title: "Cook dinner", active: true, startTime: "19:30", endTime: "", status: "done", completedAt: "19:50", xpEarned: 10 },
        { kind: "routine", id: "plan", title: "Plan tomorrow", active: true, startTime: "22:00", endTime: "", status: "missed", xpLost: 5 },
        { kind: "habit", id: "journal", title: null, active: false, timeOfDay: "evening", counted: false, target: 1, unit: "", status: "missed", quantity: 0, xpLost: 5 },
        { kind: "habit", id: "water", title: "Drink water", active: true, timeOfDay: "anytime", counted: true, target: 8, unit: "glasses", status: "partial", quantity: 3, xpLost: 3 },
        { kind: "habit", id: "read", title: "Read", active: true, timeOfDay: "anytime", counted: true, target: 20, unit: "pages", status: "missed", quantity: 0, xpLost: 5 },
    ],
    unnamed: 1,
    bonus: 0,
    xpLost: 18,
    run: 0,
    streakEnded: 6,
};

// A month of day summaries for the calendar: mostly kept, with a few days that were not
const MONTH_DAYS = Array.from({ length: 8 }, (_, index) => {
    const slipped = index === 2 || index === 5;
    return {
        date: `2026-10-0${index + 1}`,
        totalRoutines: 6,
        completedRoutines: slipped ? 4 : 6,
        totalHabits: 4,
        completedHabits: index === 6 ? 2 : 4,
        isPerfectDay: !slipped,
        xpNet: slipped ? 40 : 110,
        xpLost: slipped ? 10 : index === 6 ? 10 : 0,
    };
});

const HABITS = [
    { _id: "meditate", title: "Meditation", timeOfDay: "morning", habitType: "boolean", targetQuantity: 1, xpReward: 15, todayLog: { completed: true, quantity: 1, xpEarned: 15 } },
    { _id: "read", title: "Read", timeOfDay: "morning", habitType: "quantity", targetQuantity: 20, unit: "pages", xpReward: 15, todayLog: { completed: false, quantity: 10 } },
    { _id: "journal", title: "Journal", timeOfDay: "evening", habitType: "boolean", targetQuantity: 1, xpReward: 15, todayLog: null },
    { _id: "water", title: "Drink water", timeOfDay: "anytime", habitType: "quantity", targetQuantity: 8, unit: "glasses", xpReward: 10, todayLog: { completed: false, quantity: 5 } },
];

// The six days before the made-up one: what was due and what got done
const SUMMARIES = [10, 10, 9, 10, 7, 10].map((done, index) => ({
    date: addDays(DATE, index - 6),
    totalRoutines: 6,
    completedRoutines: Math.min(done, 6),
    totalHabits: 4,
    completedHabits: Math.max(done - 6, 0),
}));

// The made-up day before, as the recap endpoint would report it, in the ways a recap can read
const YESTERDAY = addDays(DATE, -1);
const closed = (date, fields) => ({
    date,
    totalRoutines: 6,
    completedRoutines: 6,
    totalHabits: 4,
    completedHabits: 4,
    missed: [],
    xpLost: 0,
    streakEnded: 0,
    ...fields,
});
const JOURNAL = { kind: "habit", id: "journal", title: "Journal", xpLost: 5 };
const READ = { kind: "habit", id: "read", title: "Read", xpLost: 5 };
const PLAN = { kind: "routine", id: "plan", title: "Plan tomorrow", xpLost: 5 };

const RECAPS = [
    {
        name: "One thing",
        frame: { day: DATE, from: YESTERDAY },
        days: [closed(YESTERDAY, { completedHabits: 3, missed: [JOURNAL], xpLost: 5 })],
    },
    {
        name: "A run ended",
        frame: { day: DATE, from: YESTERDAY },
        days: [
            closed(YESTERDAY, {
                completedRoutines: 5,
                completedHabits: 2,
                missed: [PLAN, JOURNAL, READ],
                xpLost: 15,
                streakEnded: 12,
            }),
        ],
    },
    {
        name: "Several days",
        frame: { day: DATE, from: addDays(DATE, -4) },
        days: [
            closed(YESTERDAY, { completedRoutines: 0, completedHabits: 0, xpLost: 45 }),
            closed(addDays(DATE, -2), { completedRoutines: 2, completedHabits: 1, xpLost: 30 }),
            closed(addDays(DATE, -3), { completedRoutines: 5, completedHabits: 3, xpLost: 10, streakEnded: 12 }),
        ],
    },
];

// What tomorrow starts with on the made-up day
const TOMORROW = firstRoutineOf(ROUTINES);
// What a day with every routine done is paid, at a run of twelve days
const BONUS = 50;

const habitLog = (habit, quantity) => {
    if (quantity <= 0) return null;
    const counted = habit.habitType === "quantity";
    const completed = !counted || quantity >= habit.targetQuantity;

    return { quantity: counted ? quantity : 1, completed, xpEarned: completed ? habit.xpReward : undefined };
};

const DayGallery = () => {
    const [routines, setRoutines] = useState(ROUTINES);
    const [habits, setHabits] = useState(HABITS);
    const [loading, setLoading] = useState(false);
    const [count, setCount] = useState(3);

    const past = useMemo(() => buildPastDay(PAST), []);
    const [month, setMonth] = useState("2026-10");
    const { marks } = useMemo(
        () => buildMonth({ month, days: MONTH_DAYS, today: DATE, live: { total: 10, done: 4 } }),
        [month],
    );
    const [memory, setMemory] = useState({});
    const [recapShown, setRecapShown] = useState(true);
    const [milestone, setMilestone] = useState(null);
    const [asking, setAsking] = useState(false);

    const day = useMemo(() => buildDay({ routines, habits, now: NOW }), [routines, habits]);
    const { isFolded, fold } = useDayFolds(day, DATE, memory, setMemory);
    const question = reopenWords({ title: "Workout", xp: 10, worth: 10 });

    const setHabit = (id, quantity) =>
        setHabits((current) =>
            current.map((habit) =>
                habit._id === id ? { ...habit, todayLog: habitLog(habit, quantity) } : habit,
            ),
        );

    const onCheck = (item, checked) => {
        if (item.kind === "routine") {
            setRoutines((current) =>
                current.map((routine) =>
                    routine._id === item.id
                        ? { ...routine, todayLog: checked ? expectedRoutineLog(routine, NOW) : null }
                        : routine,
                ),
            );
        } else if (item.counted) {
            setHabit(item.id, checked ? item.target : stepQuantity(item.target, item.target, -1));
        } else {
            setHabit(item.id, checked ? 1 : 0);
        }
    };

    const onStep = (item, direction) =>
        setHabit(item.id, stepQuantity(item.quantity, item.target, direction));

    const reset = () => {
        setRoutines(ROUTINES);
        setHabits(HABITS);
        setMemory({});
        setRecapShown(true);
    };

    // Everything in a part of the day at once, or everything in the day
    const finish = (blockId) => {
        const inBlock = (key) => day.items.some((item) => item.key === key && (!blockId || item.block === blockId));

        setRoutines((current) =>
            current.map((routine) =>
                inBlock(`routine:${routine._id}`) && !routine.todayLog
                    ? { ...routine, todayLog: expectedRoutineLog(routine, NOW) }
                    : routine,
            ),
        );
        setHabits((current) =>
            current.map((habit) =>
                inBlock(`habit:${habit._id}`)
                    ? { ...habit, todayLog: habitLog(habit, habit.targetQuantity) }
                    : habit,
            ),
        );
    };

    return (
        <>
            <Section
                title="A day"
                note="The pieces Today is built from, at 1:35 pm on a made-up day: done, done late, late, about to start, counted part of the way, and a name too long for its row."
            >
                <div className={styles.stage}>
                    <div className={styles.stagePad}>
                        {loading ? (
                            <DaySkeleton />
                        ) : (
                            <DayLayout
                                aside={
                                    <WeekAside
                                        date={DATE}
                                        summaries={SUMMARIES}
                                        today={{ total: day.total, done: day.done }}
                                        streak={{ current: 12, best: 21 }}
                                    />
                                }
                            >
                                <DayHeader eyebrow={greetingAt(NOW)} title={formatDayTitle(DATE)} />
                                <DayRecap
                                    recap={recapShown ? buildRecap(RECAPS[0].days, RECAPS[0].frame) : null}
                                    onDismiss={() => setRecapShown(false)}
                                />
                                <DayProgress
                                    message={dayMessage(day, {
                                        nowMinutes: minutesOf(NOW),
                                        date: DATE,
                                        yesterday: tallyOf(SUMMARIES.at(-1)),
                                        streak: { current: 12, best: 21 },
                                    })}
                                    done={day.done}
                                    total={day.total}
                                    blocks={day.blocks}
                                />
                                {day.blocks.map((block) => (
                                    <DayBlock
                                        key={block.id}
                                        block={block}
                                        next={day.next}
                                        now={NOW}
                                        folded={isFolded(block)}
                                        onFold={fold}
                                        onCheck={onCheck}
                                        onStep={onStep}
                                    />
                                ))}
                                <DayTotal
                                    earned={day.earned}
                                    bonus={day.left === 0 ? BONUS : 0}
                                    note={day.sealed ? tomorrowWords(TOMORROW) : ""}
                                />
                            </DayLayout>
                        )}
                    </div>
                </div>
                <Row>
                    <Switch
                        label="Show it loading"
                        checked={loading}
                        onChange={(event) => setLoading(event.target.checked)}
                    />
                    <Button size="sm" onClick={() => finish("afternoon")}>
                        Finish the afternoon
                    </Button>
                    <Button size="sm" onClick={() => finish()}>
                        Finish the day
                    </Button>
                    <Button size="sm" onClick={reset}>
                        Start the day again
                    </Button>
                </Row>
            </Section>

            <Section
                title="The recap"
                note="What was settled when a day closed, said once at the top of the next. Only the loss is set in the colour of a loss."
            >
                {RECAPS.map((example) => (
                    <Row key={example.name} label={example.name}>
                        <div className={styles.column}>
                            <DayRecap recap={buildRecap(example.days, example.frame)} onDismiss={() => {}} />
                        </div>
                    </Row>
                ))}
            </Section>

            <Section
                title="Said after a change"
                note="A completion is named once the server has taken it, with the way to undo it. A level and a milestone are rarer."
            >
                <Row label="Toasts">
                    <Button
                        size="sm"
                        onClick={() => {
                            const { message, detail } = completionWords({ title: "Deep work", earned: 20 });
                            toast(message, { id: "gallery-done", detail, action: { label: "Undo" } });
                        }}
                    >
                        Done
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            const { message, detail } = completionWords({ title: "Workout", late: true, earned: 5 });
                            toast(message, { id: "gallery-done", detail, action: { label: "Undo" } });
                        }}
                    >
                        Done late
                    </Button>
                    <Button size="sm" onClick={() => toast(levelWords(12), { detail: "reached" })}>
                        A level
                    </Button>
                </Row>
                <Row label="Milestones">
                    {STREAK_MILESTONES.map((days) => (
                        <Button
                            key={days}
                            size="sm"
                            onClick={() => setMilestone({ days, bonus: days >= 100 ? 200 : 50, longest: days !== 14 })}
                        >
                            {days} days
                        </Button>
                    ))}
                </Row>
                <Row label="A question">
                    <Button size="sm" onClick={() => setAsking(true)}>
                        Reopen something done on time
                    </Button>
                </Row>
                <MilestoneDialog milestone={milestone} onClose={() => setMilestone(null)} />
                <ConfirmDialog
                    open={asking}
                    onOpenChange={setAsking}
                    title={question.title}
                    description={question.description}
                    confirmLabel={question.confirm}
                    cancelLabel={question.cancel}
                />
            </Section>

            <Section
                title="A day in one strip"
                note="For a week of days. What was left undone on a day that is over is outlined in the colour of a loss."
            >
                <Row label="Over">
                    <div className={styles.bars}>
                        <MiniStrip total={10} done={10} settled />
                        <MiniStrip total={10} done={7} settled />
                        <MiniStrip total={40} done={31} settled />
                    </div>
                </Row>
                <Row label="Today">
                    <div className={styles.bars}>
                        <MiniStrip total={10} done={4} />
                        <MiniStrip total={40} done={12} />
                    </div>
                </Row>
                <Row label="Nothing due">
                    <div className={styles.bars}>
                        <MiniStrip />
                    </div>
                </Row>
            </Section>

            <Section
                title="A day that is over"
                note="The same pieces, with nothing on them to press. What was done is ticked and shows what it paid; what was left is outlined in the colour of a loss and shows what it cost."
            >
                <Row label="The box, as a drawing">
                    <CheckMark checked />
                    <CheckMark progress={0.4} missed />
                    <CheckMark missed />
                </Row>
                <div className={styles.stage}>
                    <div className={styles.stagePad}>
                        <DayLayout>
                            <DayHeader eyebrow="October 2026" title={formatDayTitle(past.date)} />
                            <DayProgress
                                message={pastDayWords(past)}
                                done={past.done}
                                total={past.total}
                                blocks={past.blocks}
                                settled
                            />
                            {past.blocks.map((block) => (
                                <DayBlock
                                    key={block.id}
                                    block={block}
                                    past
                                    linkTo={(item) => (item.active ? "#" : null)}
                                />
                            ))}
                            <p className={styles.sectionNote}>{unnamedWords(past.unnamed)}</p>
                            <DayTotal
                                earned={past.earned}
                                bonus={past.bonus}
                                lost={past.lost}
                                label={pastTotalLabel(past)}
                            />
                        </DayLayout>
                    </div>
                </div>
            </Section>

            <Section
                title="A month of days"
                note="The calendar at its full size: each day is a button with its own strip under its number. A date in bold had every routine done."
            >
                <div className={styles.column}>
                    <Calendar
                        full
                        label="A month, day by day"
                        month={month}
                        onMonthChange={setMonth}
                        today={DATE}
                        min="2026-09-01"
                        max={DATE}
                        onSelect={(day) => toast(formatDayTitle(day))}
                        strongDay={(day) => Boolean(marks.get(day)?.perfect)}
                        describeDay={(day) => calendarDayWords(marks.get(day))}
                        renderDay={(day) => {
                            const mark = marks.get(day);
                            return <MiniStrip total={mark?.total} done={mark?.done} settled={mark?.settled} />;
                        }}
                    />
                </div>
                <Row label="Stated things">
                    <Facts>
                        <Fact label="Days on record">8</Fact>
                        <Fact label="XP earned">{signedXp(720)}</Fact>
                        <Fact label="XP lost" tone="loss">
                            {signedXp(-30)}
                        </Fact>
                    </Facts>
                </Row>
            </Section>

            <Section title="Stepper" note="Counts something up or down a step at a time.">
                <Row label="In use">
                    <Stepper
                        label="Glasses of water"
                        canDecrease={count > 0}
                        canIncrease={count < 8}
                        onStep={(direction) => setCount((value) => value + direction)}
                    />
                    <span className={styles.count}>
                        <b>{count}</b> of 8 glasses
                    </span>
                </Row>
                <Row label="At an end">
                    <Stepper label="Nothing yet" canDecrease={false} onStep={() => {}} />
                    <Stepper label="All of it" canIncrease={false} onStep={() => {}} />
                </Row>
            </Section>
        </>
    );
};

export default DayGallery;
