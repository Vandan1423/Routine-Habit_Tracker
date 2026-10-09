// Timings for animations driven from JavaScript. The durations and curves are the same ones
// as the CSS tokens in styles/tokens.css (--t-*, --ease, --ease-out); keep the two in step.
// Plain state changes (hover, a switch flipping) use CSS transitions. This is for what CSS cannot do:
// things entering and leaving, numbers counting, and several things moving as one gesture.

export const DURATION = {
    fast: 0.12,
    base: 0.22,
    slow: 0.34,
};

export const EASE = {
    standard: [0.2, 0, 0, 1],
    out: [0.16, 1, 0.3, 1],
};

// The only spring in the app: for the completion check settling and for numbers landing.
// It overshoots very slightly and is at rest in about a quarter of a second.
// CSS has the same spring as a curve (--spring and --t-spring in tokens.css); change one, change the other.
export const SPRING = {
    type: "spring",
    visualDuration: 0.26,
    bounce: 0.18,
};

// What a motion component does when it is given no transition of its own
export const DEFAULT_TRANSITION = {
    duration: DURATION.base,
    ease: EASE.standard,
};
