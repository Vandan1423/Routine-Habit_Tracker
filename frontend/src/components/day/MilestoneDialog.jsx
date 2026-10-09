import { Button, Dialog } from "../ui";
import useLastValue from "../../hooks/useLastValue";
import { milestoneWords } from "../../lib/dayMessage";
import styles from "./MilestoneDialog.module.css";

// A hundred days sit in rows of ten; shorter runs in weeks
const perRow = (days) => (days >= 100 ? 10 : 7);

// The longest the marks take to be drawn in, however many there are, and the most one waits for the one before
const DRAWN_WITHIN_MS = 700;
const LONGEST_STEP_MS = 45;

/**
 * The run itself, drawn the way a day is: one short ink mark for each day in it, set down one after another.
 */
const RunMarks = ({ days }) => (
    <div
        className={styles.marks}
        style={{
            "--per-row": perRow(days),
            "--step": `${Math.min(LONGEST_STEP_MS, DRAWN_WITHIN_MS / days)}ms`,
        }}
        aria-hidden="true"
    >
        {Array.from({ length: days }, (_, index) => (
            <i key={index} style={{ "--index": index }} />
        ))}
    </div>
);

/**
 * Marks a run of days reaching a milestone (7, 14, 30, 100). Rare by design: it is the one thing about
 * the day that stops to be looked at. Shown by the shell (DayNotices), over whichever screen is open.
 *
 * milestone: { days, bonus, longest }, or null while there is none to mark
 * onClose: it was closed
 */
const MilestoneDialog = ({ milestone, onClose }) => {
    const shown = useLastValue(milestone);
    const words = shown ? milestoneWords(shown.days, shown) : null;
    if (!words) return null;

    return (
        <Dialog
            open={Boolean(milestone)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            size="sm"
            title={words.title}
            description={words.body}
            footer={<Dialog.Close render={<Button variant="primary">Carry on</Button>} />}
        >
            <RunMarks days={shown.days} />
            {words.notes.length > 0 && (
                <ul className={styles.notes}>
                    {words.notes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            )}
        </Dialog>
    );
};

export default MilestoneDialog;
