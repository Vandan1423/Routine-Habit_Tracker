import { useEffect, useRef, useState } from "react";
import MilestoneDialog from "../day/MilestoneDialog";
import useAuth from "../../hooks/useAuth";
import useRemembered from "../../hooks/useRemembered";
import useToday from "../../hooks/useToday";
import { completionWords, levelWords, STREAK_MILESTONES } from "../../lib/dayMessage";
import { toast } from "../../lib/toast";

// One toast for the last thing completed: the next one takes its place
const DONE_TOAST = "today-done";
// A milestone waits for the screen's own moment (the block closing, the day folding) to play out first
const MILESTONE_AFTER_MS = 1400;

/**
 * Says what followed from a change to today once the server has accepted it: the thing completed, with
 * the way to undo it, a level reached, and a run of days reaching a milestone. It belongs to the shell,
 * not to Today, because an item can be completed from any screen (the command menu does it by name).
 */
const DayNotices = () => {
    const { subscribe, date } = useToday();
    const { user } = useAuth();

    // The last milestone this browser marked for this account, so it is marked once
    const account = user?._id ?? user?.id ?? user?.email ?? "account";
    const [marked, setMarked] = useRemembered(`milestone.${account}`, null);
    const [milestone, setMilestone] = useState(null);

    const latest = useRef({ marked, date });
    useEffect(() => {
        latest.current = { marked, date };
    });

    useEffect(() => {
        // The item the "done" toast is about
        let about = null;
        let milestoneTimer;

        const stop = subscribe((event) => {
            if (event.type === "completed") {
                const { message, detail } = completionWords(event);

                about = event.key;
                toast(message, {
                    id: DONE_TOAST,
                    detail,
                    action: { label: "Undo", onClick: event.undo },
                });
            } else if (event.type === "changed" && event.key === about) {
                // Changed again by hand: the offer to undo no longer describes it
                about = null;
                toast.dismiss(DONE_TOAST);
            } else if (event.type === "level") {
                toast(levelWords(event.level), { id: "today-level", detail: "reached" });
            } else if (event.type === "streak" && STREAK_MILESTONES.includes(event.days)) {
                const { marked: last, date: day } = latest.current;

                // Once a day: un-ticking and ticking again does not mark it twice
                if (last?.date === day && last.days === event.days) return;

                clearTimeout(milestoneTimer);
                milestoneTimer = setTimeout(() => {
                    setMarked({ date: day, days: event.days });
                    setMilestone({
                        days: event.days,
                        bonus: event.bonus,
                        longest: event.days > event.best,
                    });
                }, MILESTONE_AFTER_MS);
            } else if (event.type === "day") {
                // Yesterday's last tick cannot be undone today
                about = null;
                toast.dismiss(DONE_TOAST);
            }
        });

        return () => {
            stop();
            clearTimeout(milestoneTimer);
        };
    }, [subscribe, setMarked]);

    return <MilestoneDialog milestone={milestone} onClose={() => setMilestone(null)} />;
};

export default DayNotices;
