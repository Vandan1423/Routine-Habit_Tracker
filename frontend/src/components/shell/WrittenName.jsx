import { useEffect, useRef, useState } from "react";
import { cubicBezier } from "motion";
import useAppearance from "../../hooks/useAppearance";
import { cx } from "../../lib/cx";
import { EASE } from "../../lib/motion";
import {
    HEADLINE_FOOT,
    HEADLINE_TOP,
    LETTERS,
    WORDMARK,
    WORDMARK_HEIGHT,
    WORDMARK_WIDTH,
} from "../../lib/wordmark";
import styles from "./WrittenName.module.css";

const ease = cubicBezier(...EASE.standard);
const clamp = (value) => Math.min(1, Math.max(0, value));

// How the wait is spent. The clock writes the letters, quickly at first and then slower and slower, all four by
// about 25 seconds. The headline that joins them into one word is the answer's to draw, so the name is never
// whole before the app is ready, however long the server takes.
const PAUSE = 0.25; // seconds the unwritten name is shown before the first letter starts
const PACE = 11; // seconds for the clock to get most of the way (1 - 1/e of it)
const LETTERS_BY = 0.9; // how far the clock has got when the last letter is done
const FINISH = 0.75; // seconds from the answer to the whole name

// In the drawing's units: the letters hang from just below the headline (and the hair of stroke around it)
const HANG = HEADLINE_FOOT + 9;
const DEPTH = WORDMARK_HEIGHT - HANG + 10;
const ALONG_HEADLINE = (HEADLINE_TOP + HEADLINE_FOOT) / 2;

let drawn = 0;

/**
 * नित्यक्रम written out while the app waits: each letter inked from the headline down, then the headline itself
 * in one stroke, which is what joins Devanagari letters into a word. A saffron nib shows where the ink is going.
 * answered: the wait is over. What is left is written quickly; if no ink was down yet, nothing more is drawn.
 * headStart: seconds already waited when this appears
 * onWritten: called once, when the name is whole (or there was nothing to finish)
 */
const WrittenName = ({ answered = false, headStart = 0, onWritten, className }) => {
    const { reducedMotion } = useAppearance();
    const [id] = useState(() => `written-name-${(drawn += 1)}`);
    const [startedAt] = useState(() => performance.now() - headStart * 1000);
    const answeredAt = useRef(null);
    const told = useRef(false);
    const latestOnWritten = useRef(onWritten);
    const drops = useRef([]);
    const line = useRef(null);
    const nib = useRef(null);

    useEffect(() => {
        latestOnWritten.current = onWritten;
    });

    useEffect(() => {
        if (answered) answeredAt.current ??= performance.now();

        const tell = () => {
            if (told.current) return;
            told.current = true;
            latestOnWritten.current?.();
        };

        // Opened behind another tab: a hidden page gets no frames, and nobody would see the name finished
        if (answered && document.hidden) {
            tell();
            return undefined;
        }

        let frame;
        const paint = (now) => {
            const finishedAt = answeredAt.current;
            // The clock stops at the answer: what it wrote by then is what the finish starts from
            const waited = ((finishedAt ?? now) - startedAt) / 1000;
            const clock = 1 - Math.exp(-Math.max(0, waited - PAUSE) / PACE);
            let letters = Math.min(1, clock / LETTERS_BY);
            let joined = 0;
            let done = false;

            if (finishedAt !== null && (letters === 0 || reducedMotion)) {
                // Over before the first letter began, or no motion wanted: nothing to watch being finished
                if (letters > 0) {
                    letters = 1;
                    joined = 1;
                }
                done = true;
            } else if (finishedAt !== null) {
                const after = clamp((now - finishedAt) / 1000 / FINISH);
                letters += (1 - letters) * ease(clamp(after / 0.45));
                joined = ease(clamp((after - 0.35) / 0.65));
                done = after === 1;
            } else if (reducedMotion) {
                // Whole letters, each appearing at once
                letters = Math.floor(letters * LETTERS.length) / LETTERS.length;
            }

            drops.current.forEach((drop, index) => {
                const inked = clamp(letters * LETTERS.length - index);
                drop.setAttribute("height", DEPTH * (reducedMotion ? inked : ease(inked)));
            });
            line.current.setAttribute("width", (WORDMARK_WIDTH + 40) * joined);

            // The nib: down the letter being written, then waiting at the start of the headline, then along it
            const pen = nib.current;
            if (reducedMotion || done || waited < PAUSE) {
                pen.setAttribute("opacity", 0);
            } else if (letters < 1) {
                const index = Math.min(LETTERS.length - 1, Math.floor(letters * LETTERS.length));
                const [from, to] = LETTERS[index];
                pen.setAttribute("cx", (from + to) / 2);
                pen.setAttribute("cy", HANG + DEPTH * ease(clamp(letters * LETTERS.length - index)));
                pen.setAttribute("opacity", 1);
            } else {
                const seconds = (now - startedAt) / 1000;
                pen.setAttribute("cx", WORDMARK_WIDTH * joined);
                pen.setAttribute("cy", ALONG_HEADLINE);
                pen.setAttribute(
                    "opacity",
                    finishedAt === null
                        ? 0.6 + 0.4 * Math.cos(seconds * 2.5)
                        : 1 - clamp((joined - 0.85) / 0.15),
                );
            }

            if (done) tell();
            else frame = requestAnimationFrame(paint);
        };

        frame = requestAnimationFrame(paint);
        return () => cancelAnimationFrame(frame);
    }, [answered, reducedMotion, startedAt]);

    return (
        <svg
            className={cx(styles.name, className)}
            viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <clipPath id={`${id}-letters`}>
                    {LETTERS.map(([from, to], index) => (
                        <rect
                            key={from}
                            ref={(element) => {
                                drops.current[index] = element;
                            }}
                            x={from}
                            y={HANG}
                            width={to - from}
                            height="0"
                        />
                    ))}
                </clipPath>
                <clipPath id={`${id}-line`}>
                    <rect ref={line} x="-20" y="-60" width="0" height={HANG + 60} />
                </clipPath>
            </defs>
            <path className={styles.ghost} d={WORDMARK} />
            <path className={styles.ink} d={WORDMARK} clipPath={`url(#${id}-letters)`} />
            <path className={styles.ink} d={WORDMARK} clipPath={`url(#${id}-line)`} />
            <circle ref={nib} className={styles.nib} r="40" opacity="0" />
        </svg>
    );
};

export default WrittenName;
