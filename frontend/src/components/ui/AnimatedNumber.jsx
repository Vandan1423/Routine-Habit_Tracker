import { useEffect, useRef, useState } from "react";
import { cubicBezier } from "motion";
import useAppearance from "../../hooks/useAppearance";
import { cx } from "../../lib/cx";
import { DURATION, EASE } from "../../lib/motion";
import styles from "./AnimatedNumber.module.css";

const numberFormat = new Intl.NumberFormat();
const defaultFormat = (value) => numberFormat.format(value);

// For counts ("7 of 9"): the old value slides out as the new one slides in, upwards for a gain, downwards for a loss
const Rolling = ({ value, format, className }) => {
    const [shown, setShown] = useState({ value, previous: null, changes: 0 });

    // The value changed: remember the one it replaces, so that one can be seen leaving
    if (shown.value !== value) {
        setShown({ value, previous: shown.value, changes: shown.changes + 1 });
    }

    const text = format(shown.value);
    const rising = shown.previous === null || shown.value >= shown.previous;

    return (
        <span className={cx(styles.number, className)}>
            <span className="visually-hidden">{text}</span>
            <span
                className={styles.window}
                data-direction={rising ? "up" : "down"}
                aria-hidden="true"
            >
                {shown.previous !== null && (
                    <span key={`out-${shown.changes}`} className={styles.leaving}>
                        {format(shown.previous)}
                    </span>
                )}
                <span
                    key={`in-${shown.changes}`}
                    className={shown.changes > 0 ? styles.arriving : undefined}
                >
                    {text}
                </span>
            </span>
        </span>
    );
};

const easeOut = cubicBezier(...EASE.out);

// Runs from one number to another, handing each value on the way to `show`. Returns what stops it.
// (Written out here rather than taken from the animation library, whose `animate` would add its whole
// engine to the first download for the sake of the level indicator.)
const count = (from, to, show) => {
    const started = performance.now();
    const lasts = DURATION.slow * 1000;
    let frame = requestAnimationFrame(function step(now) {
        const progress = Math.min((now - started) / lasts, 1);

        show(Math.round(from + (to - from) * easeOut(progress)));
        if (progress < 1) frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
};

// For totals such as XP: runs through the values in between
const Counting = ({ value, format, className }) => {
    const { reducedMotion } = useAppearance();
    const nodeRef = useRef(null);
    // What is on screen right now, which mid-animation is not `value`
    const shownRef = useRef(value);
    // React renders this text once; from then on the effect below writes each frame straight to the element
    const [initialText] = useState(() => format(value));

    useEffect(() => {
        const show = (number) => {
            shownRef.current = number;
            nodeRef.current.textContent = format(number);
        };

        if (shownRef.current === value) {
            return;
        }
        if (reducedMotion) {
            show(value);
            return;
        }

        return count(shownRef.current, value, show);
    }, [value, format, reducedMotion]);

    return (
        <span className={cx(styles.number, className)}>
            <span className="visually-hidden">{format(value)}</span>
            <span ref={nodeRef} aria-hidden="true">
                {initialText}
            </span>
        </span>
    );
};

/**
 * A number that never jumps when it changes.
 * mode: "roll" (the default) swaps the old value for the new one with a small slide; use it for counts.
 *       "count" runs through the values in between; use it for totals such as XP.
 * format: turns the number into text. Screen readers are given the final value only, once.
 */
const AnimatedNumber = ({ value, mode = "roll", format = defaultFormat, className }) =>
    mode === "count" ? (
        <Counting value={value} format={format} className={className} />
    ) : (
        <Rolling value={value} format={format} className={className} />
    );

export default AnimatedNumber;
