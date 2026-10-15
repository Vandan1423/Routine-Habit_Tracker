// The opening screen (Launch in components/shell) stays over the app until nothing holds the app back any more.
// Whatever holds it back (the session check, so far) calls holdLaunch() while it does and calls what that returns
// when it is done. Once the opening screen has gone it does not come back: endLaunch() says so, for the rest of the visit.

// A first request still unanswered after this many seconds is almost certainly waiting for the server to wake,
// and the wait starts to explain itself
export const WAKING_AFTER = 4;

let holds = 0;
let over = false;
const listeners = new Set();

const tell = () => listeners.forEach((listener) => listener());

export const holdLaunch = () => {
    holds += 1;
    tell();

    let released = false;
    return () => {
        if (released) return;
        released = true;
        holds -= 1;
        tell();
    };
};

export const launchHeld = () => holds > 0;

export const launchOver = () => over;

export const endLaunch = () => {
    over = true;
    tell();
};

export const subscribeLaunch = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
