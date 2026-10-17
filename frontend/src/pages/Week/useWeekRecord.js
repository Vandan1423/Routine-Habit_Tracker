import { useCallback, useEffect, useRef, useState } from "react";
import { isDraftId, newDraftId } from "../../lib/drafts";
import { toast } from "../../lib/toast";
import { NOT_SAVED_WEEK } from "../../lib/weekWords";
import weekService from "../../services/weekService";

const EMPTY = { focus: [], notes: "", wentWell: "", better: "" };

// A focus line as it is sent: one written here a moment ago has no id of the server's yet
const sentFocus = (focus) =>
    focus.map(({ _id, title, done, goal }) => ({
        ...(isDraftId(_id) ? {} : { _id }),
        title,
        done: Boolean(done),
        goalId: goal ?? null,
    }));

/**
 * A week's focus, notes and review (services/weekService.js), for the week that starts on `start`.
 * A change is shown at once and sent after; the server's answer is taken up only if nothing has changed
 * since it was sent, so typing on is never undone by an answer to an earlier change. A refusal says so in
 * a toast, which offers to send it again.
 * @returns {Object} - { week: { focus, notes, wentWell, better }, status: "loading" | "ready" | "error",
 *   save(fields), addFocus(title), retry() }
 */
const useWeekRecord = (start) => {
    const [state, setState] = useState({ start, week: EMPTY, status: "loading" });
    const [attempt, setAttempt] = useState(0);
    const changes = useRef(0);

    // Another week: start from nothing until it has been read
    let current = state;
    if (state.start !== start) {
        current = { start, week: EMPTY, status: "loading" };
        setState(current);
    }

    useEffect(() => {
        let live = true;
        const before = changes.current;

        weekService
            .getWeek(start)
            .then((week) => {
                if (live && changes.current === before) setState({ start, week: { ...EMPTY, ...week }, status: "ready" });
            })
            .catch(() => {
                if (live) setState((held) => (held.start === start && held.status === "ready" ? held : { ...held, status: "error" }));
            });

        return () => {
            live = false;
        };
    }, [start, attempt]);

    const save = useCallback(
        (fields) => {
            changes.current += 1;
            const mine = changes.current;
            setState((held) => (held.start === start ? { ...held, week: { ...held.week, ...fields }, status: "ready" } : held));

            const body = fields.focus ? { ...fields, focus: sentFocus(fields.focus) } : fields;
            const send = () =>
                weekService.saveWeek(start, body).then(
                    (week) => {
                        // The ids the server gave new lines, taken up only when nothing has changed since
                        if (changes.current === mine) {
                            setState((held) => (held.start === start ? { ...held, week: { ...EMPTY, ...week } } : held));
                        }
                    },
                    () =>
                        toast.error(NOT_SAVED_WEEK, {
                            id: `week-${start}`,
                            action: { label: "Try again", onClick: send },
                        }),
                );
            send();
        },
        [start],
    );

    const addFocus = useCallback(
        (title, focus) => save({ focus: [...focus, { _id: newDraftId("focus"), title, done: false, goal: null }] }),
        [save],
    );

    const retry = useCallback(() => setAttempt((count) => count + 1), []);

    return { week: current.week, status: current.status, save, addFocus, retry };
};

export default useWeekRecord;
