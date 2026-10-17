import { useRef } from "react";
import { cx } from "../../lib/cx";
import { dialNumbers, handOf, isChosen, valueAt } from "../../lib/clock";
import styles from "./ClockFace.module.css";

// The hand's length to the outer and the inner ring, out of a dial 100 across (see dialNumbers)
const OUTER = 40;
const INNER = 26;

/**
 * The round dial a time is picked on: the hours, or the minutes in fives. A press chooses the number
 * under it, and dragging moves the hand round; letting go says the choice is made (TimePicker then
 * turns from the hours to the minutes). It is for the pointer only: the boxes above it in TimePicker
 * are what the keyboard and screen readers use, so the dial itself is hidden from them.
 *
 * view: "hours" or "minutes". draft: { hours, minutes }. hour12: am and pm, or a 24-hour clock with two rings.
 * onPick(value): the hour of the day (0 to 23) or the minute under the pointer, as it moves
 * onPicked(): the pointer was let go
 */
const ClockFace = ({ view, draft, hour12, onPick, onPicked }) => {
    const face = useRef(null);
    const held = useRef(false);

    const numbers = dialNumbers(view, { hour12 });
    const hand = handOf(view, draft, { hour12 });
    const length = hand.inner ? INNER : OUTER;
    const radians = (hand.angle * Math.PI) / 180;
    const tip = { x: 50 + length * Math.sin(radians), y: 50 - length * Math.cos(radians) };
    // A minute that was typed between the fives has no number under the hand: the knob carries a dot instead
    const between = view === "minutes" && draft.minutes % 5 !== 0;

    const pickAt = (event) => {
        const box = face.current.getBoundingClientRect();
        const value = valueAt(
            view,
            (event.clientX - box.left) / box.width,
            (event.clientY - box.top) / box.height,
            { hour12, draft },
        );
        if (value !== null) onPick(value);
    };

    return (
        <div
            ref={face}
            className={styles.face}
            aria-hidden="true"
            onPointerDown={(event) => {
                if (event.button !== 0) return;
                // Keeps the cursor in the box being typed in, so typing can carry on after a press
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                held.current = true;
                pickAt(event);
            }}
            onPointerMove={(event) => {
                if (held.current) pickAt(event);
            }}
            onPointerUp={() => {
                if (!held.current) return;
                held.current = false;
                onPicked();
            }}
            onPointerCancel={() => {
                held.current = false;
            }}
        >
            <svg className={styles.hand} viewBox="0 0 100 100">
                <line x1="50" y1="50" x2={tip.x} y2={tip.y} />
                <circle className={styles.pivot} cx="50" cy="50" r="1.6" />
                <circle className={styles.knob} cx={tip.x} cy={tip.y} r={hand.inner ? 6 : 7.5} />
                {between && <circle className={styles.dot} cx={tip.x} cy={tip.y} r="1.4" />}
            </svg>
            {numbers.map((number) => (
                <span
                    key={`${number.inner ? "in" : "out"}-${number.value}`}
                    className={cx(
                        styles.number,
                        number.inner && styles.inner,
                        isChosen(view, number, draft, { hour12 }) && styles.chosen,
                    )}
                    style={{ left: `${number.x * 100}%`, top: `${number.y * 100}%` }}
                >
                    {number.label}
                </span>
            ))}
        </div>
    );
};

export default ClockFace;
