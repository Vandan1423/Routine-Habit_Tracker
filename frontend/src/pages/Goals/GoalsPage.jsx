import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GoalEditor from "./GoalEditor";
import GoalSection from "./GoalSection";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import { Button, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import useFetched from "../../hooks/useFetched";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { cx } from "../../lib/cx";
import { addDays, localDay } from "../../lib/dates";
import { newDraftId } from "../../lib/drafts";
import { draftGoal, KEPT_DAYS, layoutGoals, talliesOf, withGoal, withGoalPlaced, withMilestone } from "../../lib/goals";
import {
    goalGoneWords,
    goalRefusedWords,
    goalsWords,
    NOT_DELETED_WORDS,
    NOT_RESTORED_WORDS,
    NOT_SAVED_WORDS,
    reachedWords,
} from "../../lib/goalWords";
import { toast } from "../../lib/toast";
import goalService from "../../services/goalService";
import { newKey } from "../../services/outbox";
import historyService from "../../services/historyService";
import trashService from "../../services/trashService";
import styles from "./GoalsPage.module.css";

// The goals while they are on their way: a heading and a few lines for each, where the real ones will be
const GoalsSkeleton = () => (
    <div aria-hidden="true">
        {["24ch", "17ch"].map((width) => (
            <div key={width} className={styles.goal}>
                <div className={cx(styles.goalTitle, styles.line)}>
                    <Skeleton variant="text" width={width} />
                </div>
                <div className={cx(styles.goalMeta, styles.line)}>
                    <Skeleton variant="text" width="20ch" />
                </div>
                <div className={cx(styles.note, styles.line)}>
                    <Skeleton variant="text" width="34ch" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * Goals: what the routines and habits are for. A goal has a name, a day to reach it by if there is one,
 * milestones to tick off on the way, and the routines and habits that carry it, each shown with how it
 * has been kept lately. A goal earns no XP and costs none.
 */
const GoalsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const plan = usePlan();
    const day = useToday();
    const account = user?._id ?? user?.id ?? user?.email ?? "account";

    const { data, status, retry, update } = useFetched(`goals:${account}`, goalService.getGoals);
    const today = data?.today ?? day.date ?? localDay();

    // How each routine and habit has gone lately. An extra: the goals are shown without it if it never arrives.
    const from = addDays(today, -(KEPT_DAYS - 1));
    const kept = useFetched(`goal-items:${account}:${from}`, () => historyService.getItems(from, today));

    const [editing, setEditing] = useState(null);

    // The form offers what is in the plan, whichever screen was open before this one
    const { ensure } = plan;
    useEffect(() => {
        ensure();
    }, [ensure]);

    const layout = useMemo(
        () => layoutGoals(data?.goals, { today, tallies: talliesOf(kept.data?.items) }),
        [data, today, kept.data],
    );

    // Arrived by "New goal" from somewhere else: the form opens, and the address then forgets that it
    // was asked for, so coming back to it does not open the form again
    const wantsNew = Boolean(location.state?.add);
    const [answered, setAnswered] = useState(null);
    if (wantsNew && answered !== location.key) {
        setAnswered(location.key);
        setEditing({});
    }
    useEffect(() => {
        if (wantsNew) navigate(location.pathname, { replace: true, state: null });
    }, [wantsNew, navigate, location.pathname]);

    const show = (goal) => update((held) => ({ ...held, goals: withGoal(held.goals, goal) }));

    /**
     * Sets a goal, or rewrites one. It is on the page at once, as the form gave it, and the form does not
     * wait; if the server refuses, it is taken back and a toast says so.
     * @param {String} [sentAs] - the key a new one was sent under before, when this is a second try
     */
    const save = (payload, existing, sentAs = newKey()) => {
        const draft = draftGoal(payload, {
            id: newDraftId("goal"),
            existing,
            items: [...plan.routines, ...day.habits],
        });
        const put = (goal) => update((held) => ({ ...held, goals: withGoalPlaced(held.goals, goal, draft._id) }));

        put(draft);

        (existing ? goalService.updateGoal(existing._id, payload) : goalService.createGoal(payload, sentAs)).then(
            (goal) => {
                put(goal);
                retry();
            },
            (failure) => {
                const words = goalRefusedWords(payload.title, Boolean(existing), failure);

                if (existing) put(existing);
                else update((held) => ({ ...held, goals: held.goals.filter((entry) => entry._id !== draft._id) }));
                // No answer at all is not a refusal: read again, in case the server has it
                if (!failure?.cause?.response) retry();
                toast.error(words.message, {
                    detail: words.detail,
                    action: { label: "Try again", onClick: () => save(payload, existing, sentAs) },
                });
            },
        );
    };

    // Shown at once, then replaced by the goal as the server holds it
    const tick = async (goal, milestone, done) => {
        const before = data.goals.find((entry) => entry._id === goal.id);
        show(withMilestone(before, milestone.id, done));

        try {
            show(await goalService.setMilestone(goal.id, milestone.id, done));
        } catch {
            show(before);
            toast.error(NOT_SAVED_WORDS);
        }
    };

    // Reached, or open again: it moves at once, and goes back if the server refuses
    const reach = async (goal, reached) => {
        const before = data.goals.find((entry) => entry._id === goal.id);
        const place = (entry) => update((held) => ({ ...held, goals: withGoalPlaced(held.goals, entry) }));

        place({ ...before, reachedAt: reached ? new Date().toISOString() : null });

        try {
            await goalService.updateGoal(goal.id, { reached });
            if (reached) toast(reachedWords(goal));
        } catch {
            place(before);
            toast.error(NOT_SAVED_WORDS);
        } finally {
            retry();
        }
    };

    const restore = async (goal) => {
        try {
            await trashService.restore("goal", goal.id);
        } catch {
            toast.error(NOT_RESTORED_WORDS);
        } finally {
            retry();
        }
    };

    // Gone from the page at once, with a moment to take it back
    const remove = async (goal) => {
        update((held) => ({ ...held, goals: held.goals.filter((entry) => entry._id !== goal.id) }));

        try {
            await goalService.deleteGoal(goal.id);
            toast(goalGoneWords(goal), {
                id: `goal-deleted-${goal.id}`,
                action: { label: "Undo", onClick: () => restore(goal) },
            });
        } catch {
            toast.error(NOT_DELETED_WORDS);
        } finally {
            retry();
        }
    };

    const edit = (goal) => setEditing({ goal: data.goals.find((entry) => entry._id === goal.id) });
    const sectionProps = { onTick: tick, onEdit: edit, onReach: reach, onDelete: remove };

    const header = (
        <header className={styles.header}>
            <div className={styles.text}>
                <p className={styles.eyebrow}>{status === "ready" && layout.total > 0 ? goalsWords(layout) : " "}</p>
                <h1 className={styles.title}>Goals</h1>
            </div>
            {status === "ready" && layout.total > 0 && (
                <Button icon="plus" onClick={() => setEditing({})}>
                    New goal
                </Button>
            )}
        </header>
    );
    const editor = (
        <GoalEditor
            request={editing}
            routines={plan.routines}
            habits={day.habits}
            today={today}
            onSave={save}
            onClose={() => setEditing(null)}
        />
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <ErrorState className={styles.state} title="The goals didn’t load" onRetry={retry} />
                </DayLayout>
            </Page>
        );
    }

    if (status !== "ready") {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <p className="visually-hidden" role="status">
                        Loading the goals
                    </p>
                    <GoalsSkeleton />
                </DayLayout>
            </Page>
        );
    }

    if (layout.total === 0) {
        return (
            <Page>
                <DayLayout>
                    {header}
                    <EmptyState
                        className={styles.state}
                        title="What are the days for?"
                        actions={
                            <Button variant="primary" onClick={() => setEditing({})}>
                                Set a goal
                            </Button>
                        }
                    >
                        A goal is something to reach: a distance, a language, a book finished. Give it
                        milestones to tick off on the way, and link the routines and habits that carry
                        it, so you can see how they are being kept. A goal earns no XP and costs none.
                    </EmptyState>
                </DayLayout>
                {editor}
            </Page>
        );
    }

    return (
        <Page>
            <DayLayout>
                {header}
                {layout.open.map((goal) => (
                    <GoalSection key={goal.id} goal={goal} {...sectionProps} />
                ))}
                {layout.reached.length > 0 && (
                    <>
                        <h2 className={styles.reachedHead}>Reached</h2>
                        {layout.reached.map((goal) => (
                            <GoalSection key={goal.id} goal={goal} {...sectionProps} />
                        ))}
                    </>
                )}
            </DayLayout>
            {editor}
        </Page>
    );
};

export default GoalsPage;
