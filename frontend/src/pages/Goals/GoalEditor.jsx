import { useId, useRef, useState } from "react";
import { Button, Checkbox, DatePicker, Dialog, IconButton, Input, Textarea } from "../../components/ui";
import useLastValue from "../../hooks/useLastValue";
import {
    emptyGoal,
    goalFormOf,
    goalPayload,
    linkChoices,
    MOST_LINKS,
    MOST_MILESTONES,
    newMilestoneRow,
    validateGoal,
} from "../../lib/goals";
import { KIND_LABEL, NOT_SAVED_WORDS } from "../../lib/goalWords";
import styles from "./GoalEditor.module.css";

const NO_ERRORS = {};

/**
 * The form a goal is set in, or changed in: what it is, by when if there is a when, the milestones on
 * the way, and the routines and habits that carry it.
 *
 * request: { goal } to change that goal, {} for a new one, null while closed
 * routines, habits: what the plan holds, for "Carried by". today: "YYYY-MM-DD"
 * onSave(payload, goal): resolves once saved, rejects with the reason if it was not
 * onClose(): it wants to close
 */
const GoalEditor = ({ request, routines, habits, today, onSave, onClose }) => {
    const formId = useId();
    const titleRef = useRef(null);
    // What it is about stays in place while it closes
    const shown = useLastValue(request);
    const editing = shown?.goal ?? null;

    const [seen, setSeen] = useState(null);
    const [form, setForm] = useState(emptyGoal);
    const [errors, setErrors] = useState(NO_ERRORS);
    const [saving, setSaving] = useState(false);
    // The milestone row that was just added, so the cursor can go to it
    const [fresh, setFresh] = useState(null);

    // Opened afresh: it starts from the goal as it stands, or from nothing
    if (request !== seen) {
        setSeen(request);
        if (request) {
            setForm(request.goal ? goalFormOf(request.goal) : emptyGoal());
            setErrors(NO_ERRORS);
            setFresh(null);
        }
    }

    const set = (fields) => {
        setForm((current) => ({ ...current, ...fields }));
        if (errors !== NO_ERRORS) setErrors(NO_ERRORS);
    };

    const setMilestone = (key, title) =>
        set({
            milestones: form.milestones.map((milestone) => (milestone.key === key ? { ...milestone, title } : milestone)),
        });

    const addMilestone = () => {
        const row = newMilestoneRow();
        setFresh(row.key);
        set({ milestones: [...form.milestones, row] });
    };

    const toggleLink = (key, on) =>
        set({ links: on ? [...form.links, key] : form.links.filter((entry) => entry !== key) });

    const close = () => {
        if (!saving) onClose();
    };

    const submit = async (event) => {
        event.preventDefault();
        if (saving) return;

        const found = validateGoal(form);
        if (Object.keys(found).length > 0) {
            setErrors(found);
            if (found.title) titleRef.current?.focus();
            return;
        }

        setSaving(true);
        try {
            await onSave(goalPayload(form), editing);
            onClose();
        } catch (failure) {
            setErrors({ form: failure?.message || NOT_SAVED_WORDS });
        } finally {
            setSaving(false);
        }
    };

    const choices = linkChoices(routines, habits, editing);

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={editing ? "Edit goal" : "New goal"}
            dismissible={false}
            footer={
                <>
                    <Button onClick={close}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} loading={saving}>
                        {editing ? "Save" : "Set goal"}
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                <Input
                    ref={titleRef}
                    label="Goal"
                    placeholder="Run ten kilometres without stopping"
                    value={form.title}
                    maxLength={120}
                    autoComplete="off"
                    error={errors.title}
                    onChange={(event) => set({ title: event.target.value })}
                />
                <Textarea
                    label="Note"
                    hint="Why it matters, or how you will know you are there. Optional."
                    rows={2}
                    value={form.note}
                    maxLength={500}
                    error={errors.note}
                    onChange={(event) => set({ note: event.target.value })}
                />
                <div className={styles.date}>
                    <DatePicker
                        className={styles.dateField}
                        label="By"
                        placeholder="No date"
                        value={form.targetDate}
                        today={today}
                        onChange={(day) => set({ targetDate: day })}
                    />
                    {form.targetDate && (
                        <Button variant="ghost" onClick={() => set({ targetDate: "" })}>
                            No date
                        </Button>
                    )}
                </div>

                <fieldset className={styles.group}>
                    <legend className={styles.legend}>Milestones</legend>
                    <p className={styles.hint}>The steps on the way, in order. Tick them off as you pass them.</p>
                    {form.milestones.length > 0 && (
                        <ol className={styles.milestones}>
                            {form.milestones.map((milestone, index) => (
                                <li key={milestone.key} className={styles.milestone}>
                                    <Input
                                        className={styles.milestoneField}
                                        aria-label={`Milestone ${index + 1}`}
                                        placeholder={`Milestone ${index + 1}`}
                                        value={milestone.title}
                                        maxLength={120}
                                        autoComplete="off"
                                        autoFocus={milestone.key === fresh}
                                        onChange={(event) => setMilestone(milestone.key, event.target.value)}
                                    />
                                    <IconButton
                                        icon="close"
                                        label={`Remove milestone ${index + 1}`}
                                        onClick={() =>
                                            set({ milestones: form.milestones.filter((row) => row.key !== milestone.key) })
                                        }
                                    />
                                </li>
                            ))}
                        </ol>
                    )}
                    {form.milestones.length < MOST_MILESTONES && (
                        <Button size="sm" icon="plus" className={styles.add} onClick={addMilestone}>
                            Add a milestone
                        </Button>
                    )}
                </fieldset>

                {choices.length > 0 && (
                    <fieldset className={styles.group}>
                        <legend className={styles.legend}>Carried by</legend>
                        <p className={styles.hint}>
                            The routines and habits that work towards it. The goal shows how each has
                            been kept.
                        </p>
                        <ul className={styles.choices}>
                            {choices.map((choice) => {
                                const on = form.links.includes(choice.key);

                                return (
                                    <li key={choice.key}>
                                        <Checkbox
                                            className={styles.choice}
                                            checked={on}
                                            // One that has left the plan can be let go of, not taken up again
                                            disabled={(!on && choice.gone) || (!on && form.links.length >= MOST_LINKS)}
                                            onChange={(event) => toggleLink(choice.key, event.target.checked)}
                                            label={
                                                <>
                                                    {choice.title}
                                                    <span className={styles.kind}>
                                                        {choice.gone ? "No longer in the plan" : KIND_LABEL[choice.kind]}
                                                    </span>
                                                </>
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </fieldset>
                )}

                {errors.form && (
                    <p className={styles.formError} role="alert">
                        {errors.form}
                    </p>
                )}
            </form>
        </Dialog>
    );
};

export default GoalEditor;
