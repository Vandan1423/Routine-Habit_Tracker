import { useId, useState } from "react";
import { Button, DatePicker, Dialog, Input } from "../ui";
import useLastValue from "../../hooks/useLastValue";
import usePlan from "../../hooks/usePlan";
import useToday from "../../hooks/useToday";
import { addDays, localDay } from "../../lib/dates";
import { KIND_WORDS, pauseSpanWords } from "../../lib/itemWords";
import { MOST_PAUSE_DAYS, pauseAhead } from "../../lib/pauses";
import styles from "./PauseDialog.module.css";

// The lengths most pauses are, one press away
const LENGTHS = [
    { label: "3 days", days: 3 },
    { label: "1 week", days: 7 },
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
];

// How many days from one "YYYY-MM-DD" to another
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

const daysIn = (text) => {
    const days = Number(text);
    return Number.isInteger(days) && days >= 1 && days <= MOST_PAUSE_DAYS ? days : null;
};

/**
 * Pausing a routine or a habit: from which day, and for how many days. While it is paused it is off the
 * days chosen, so they cost nothing and no run is broken; it comes back by itself once they are over.
 *
 * request: what to open with, or null while closed: { kind: "routine" | "habit", item } (item as the API sent it)
 * onClose(): it wants to close
 */
const PauseDialog = ({ request, onClose }) => {
    const formId = useId();
    const { pauseItem } = usePlan();
    const { date } = useToday();
    const today = date ?? localDay();

    // What it is showing stays in place while it closes
    const shown = useLastValue(request);
    const kind = shown?.kind ?? "routine";
    const item = shown?.item ?? null;

    const [seen, setSeen] = useState(null);
    const [from, setFrom] = useState(today);
    const [length, setLength] = useState("7");
    const [error, setError] = useState("");

    // Opened afresh: on the pause it already has, what is left of it; otherwise a week from today
    if (request !== seen) {
        setSeen(request);
        if (request) {
            const current = pauseAhead(request.item, today);
            const start = current && current.from > today ? current.from : today;

            setFrom(start);
            setLength(current ? String(daysBetween(start, current.until) + 1) : "7");
            setError("");
        }
    }

    const days = daysIn(length);

    const submit = (event) => {
        event.preventDefault();
        if (!days) {
            setError(`Choose between 1 and ${MOST_PAUSE_DAYS} days.`);
            return;
        }

        // It is shown paused at once; if the server refuses, it is put back and a toast says why
        pauseItem(kind, item, { from: from < today ? today : from, days });
        onClose();
    };

    return (
        <Dialog
            open={Boolean(request)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={
                item
                    ? `${pauseAhead(item, today) ? "Change pause for" : "Pause"} “${item.title}”`
                    : `Pause ${KIND_WORDS[kind].name}`
            }
            description="Away for a while? It stays in the plan, but asks nothing of the days it is off."
            size="sm"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId} icon="pause">
                        Pause
                    </Button>
                </>
            }
        >
            <form id={formId} className={styles.form} onSubmit={submit} noValidate>
                <DatePicker
                    label="Starting"
                    value={from}
                    today={today}
                    min={today}
                    max={addDays(today, MOST_PAUSE_DAYS)}
                    onChange={setFrom}
                />
                <div>
                    <Input
                        label="For how many days"
                        inputMode="numeric"
                        autoComplete="off"
                        value={length}
                        error={error}
                        trailing={days === 1 ? "day" : "days"}
                        onChange={(event) => {
                            setLength(event.target.value.replace(/[^\d]/g, "").slice(0, 3));
                            setError("");
                        }}
                    />
                    <div className={styles.lengths}>
                        {LENGTHS.map((option) => (
                            <Button
                                key={option.days}
                                variant="ghost"
                                size="sm"
                                aria-pressed={days === option.days}
                                onClick={() => {
                                    setLength(String(option.days));
                                    setError("");
                                }}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
                <p className={styles.summary} aria-live="polite">
                    {days ? pauseSpanWords({ from, days }, today) : " "}
                </p>
            </form>
        </Dialog>
    );
};

export default PauseDialog;
