import { useEffect, useRef, useState } from "react";
import { Textarea } from "../../components/ui";

// How long typing rests before what was typed is kept
const QUIET_MS = 1000;

/**
 * Some lines of writing that keep themselves: what is typed is saved once typing rests for a moment,
 * and when the field is left. There is no button. A value that changes from outside (another week, an
 * answer from the server) is taken up only while nothing typed here is waiting to be kept.
 *
 * value: what is kept. onSave(text): keep this
 * label, placeholder, rows, maxRows: as on Textarea
 */
const SavedText = ({ value = "", onSave, label, placeholder, rows = 3, maxRows = 12, className }) => {
    const [text, setText] = useState(value);
    // Something typed here that has not been kept yet
    const [waiting, setWaiting] = useState(false);
    const [shownFor, setShownFor] = useState(value);
    const timer = useRef(null);

    if (!waiting && shownFor !== value) {
        setShownFor(value);
        setText(value);
    }

    const keep = (typed) => {
        clearTimeout(timer.current);
        setWaiting(false);
        if (typed !== value) onSave(typed);
    };

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <Textarea
            className={className}
            label={label}
            placeholder={placeholder}
            rows={rows}
            maxRows={maxRows}
            maxLength={4000}
            value={text}
            onChange={(event) => {
                const typed = event.target.value;
                setText(typed);
                setWaiting(true);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => keep(typed), QUIET_MS);
            }}
            onBlur={() => {
                if (waiting) keep(text);
            }}
        />
    );
};

export default SavedText;
