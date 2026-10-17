import { useCallback, useEffect, useRef, useState } from "react";

// How far a mouse moves before a press becomes a carry, and how long a finger is held still before it does.
// A finger that moves first is scrolling the page, and is left to it.
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const TOUCH_HOLD_MS = 350;

// Pressing these is never the start of a carry
const NOT_A_HANDLE = 'input, textarea, select, [role="menuitem"], [aria-haspopup], [data-no-carry]';

// The place under the pointer that something can be put down on: the nearest [data-drop] around it
const dropAt = (x, y) => {
    for (const element of document.elementsFromPoint(x, y)) {
        const place = element.closest("[data-drop]");
        if (place) return place;
    }
    return null;
};

/**
 * Lets things be picked up and carried with the pointer, and put down on a place marked `data-drop`.
 * A press that never became a carry is an ordinary press: its click goes through. One that did swallows
 * the click that follows it. The keyboard has its own way to move each thing (a menu), so this is for the
 * pointer only.
 *
 * onDrop({ id, data, place, dx, dy, x, y }): it was put down; place is the [data-drop] element under the
 *   pointer, or null
 * onOver(place): the place under a carried thing changed (null for none), for picking it out
 * Returns { handle(id, data): props for the thing (onPointerDown, onDragStart), carrying: { id, dx, dy } | null }
 */
const useCarry = ({ onDrop, onOver } = {}) => {
    const [carrying, setCarrying] = useState(null);
    const gesture = useRef(null);
    const handlers = useRef({ onDrop, onOver });

    useEffect(() => {
        handlers.current = { onDrop, onOver };
    });

    const end = useCallback(() => {
        const current = gesture.current;
        if (!current) return;

        clearTimeout(current.timer);
        window.removeEventListener("pointermove", current.move);
        window.removeEventListener("pointerup", current.up);
        window.removeEventListener("pointercancel", current.cancel);
        window.removeEventListener("touchmove", current.holdStill);
        document.documentElement.removeAttribute("data-carrying");
        gesture.current = null;
        setCarrying(null);
    }, []);

    useEffect(() => end, [end]);

    const handle = useCallback(
        (id, data) => ({
            // A link or a picture is the browser's to drag by itself, which would take the pointer away
            onDragStart: (event) => event.preventDefault(),
            onPointerDown: (event) => {
                if (event.button !== 0 || gesture.current) return;
                if (event.target.closest(NOT_A_HANDLE)) return;

                const touch = event.pointerType === "touch";
                const state = {
                    id,
                    data,
                    startX: event.clientX,
                    startY: event.clientY,
                    carried: false,
                    place: null,
                };

                const begin = () => {
                    state.carried = true;
                    document.documentElement.setAttribute("data-carrying", "");
                    setCarrying({ id, dx: 0, dy: 0 });
                };

                state.move = (move) => {
                    const dx = move.clientX - state.startX;
                    const dy = move.clientY - state.startY;

                    if (!state.carried) {
                        const far = Math.hypot(dx, dy);
                        if (touch) {
                            // Moved before the hold was over: a scroll, not a carry
                            if (far > TOUCH_SLOP) end();
                            return;
                        }
                        if (far < MOUSE_SLOP) return;
                        begin();
                    }

                    const place = dropAt(move.clientX, move.clientY);
                    if (place !== state.place) {
                        state.place = place;
                        handlers.current.onOver?.(place);
                    }
                    setCarrying({ id, dx, dy });
                };

                state.up = (up) => {
                    if (state.carried) {
                        // The click this release makes lands on whatever is under it: it is not a press
                        const swallow = (click) => {
                            click.stopPropagation();
                            click.preventDefault();
                        };
                        window.addEventListener("click", swallow, { capture: true, once: true });
                        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);

                        handlers.current.onOver?.(null);
                        handlers.current.onDrop?.({
                            id,
                            data,
                            place: dropAt(up.clientX, up.clientY),
                            dx: up.clientX - state.startX,
                            dy: up.clientY - state.startY,
                            x: up.clientX,
                            y: up.clientY,
                        });
                    }
                    end();
                };

                state.cancel = () => {
                    handlers.current.onOver?.(null);
                    end();
                };

                // While a finger carries something the page must not scroll under it
                state.holdStill = (touchMove) => {
                    if (state.carried) touchMove.preventDefault();
                };

                if (touch) state.timer = setTimeout(begin, TOUCH_HOLD_MS);

                gesture.current = state;
                window.addEventListener("pointermove", state.move);
                window.addEventListener("pointerup", state.up);
                window.addEventListener("pointercancel", state.cancel);
                window.addEventListener("touchmove", state.holdStill, { passive: false });
            },
        }),
        [end],
    );

    return { handle, carrying };
};

export default useCarry;
