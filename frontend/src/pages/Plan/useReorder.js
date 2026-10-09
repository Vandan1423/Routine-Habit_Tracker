import { useEffect, useRef, useState } from "react";
import { moveWithin } from "../../lib/plan";

/**
 * Lets the rows of one list be put in another order: by dragging a row's handle, or with the arrow
 * keys while the handle has the focus.
 *
 * While a row is dragged it follows the pointer and the rows it passes step aside; nothing is
 * reordered until it is let go. Esc, or the pointer being taken away, puts everything back.
 *
 * The list element carries `data-reorder-list`, each row `data-reorder={id}`.
 *
 * ids: the rows' ids in the order they stand
 * onReorder(ids, { id, to }): called with the new order
 * @returns {Object} - handleProps(id): for the row's handle; rowStyle(id): for the row itself;
 *   dragging: the id being dragged, or null; settling: true for a frame after a drop, when rows must not animate
 */
const useReorder = ({ ids, onReorder }) => {
    const [drag, setDrag] = useState(null);
    const [settling, setSettling] = useState(false);
    // The drag as it stands, for the handlers: state is a render behind a moving pointer
    const live = useRef(null);

    const finish = (commit) => {
        const current = live.current;
        if (!current) return;

        live.current = null;
        setSettling(true);
        setDrag(null);
        if (commit && current.to !== current.from) {
            onReorder(moveWithin(ids, current.from, current.to), { id: current.id, to: current.to });
        }
        // The rows are now where they were being shown. For one frame nothing may animate towards that.
        requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    };

    const active = drag !== null;
    useEffect(() => {
        if (!active) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") finish(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    const handleProps = (id) => ({
        onPointerDown: (event) => {
            if (event.button !== 0 || ids.length < 2) return;

            const list = event.currentTarget.closest("[data-reorder-list]");
            const rects = ids.map((entry) =>
                list?.querySelector(`[data-reorder="${entry}"]`)?.getBoundingClientRect(),
            );
            if (!list || rects.some((rect) => !rect)) return;

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);

            const from = ids.indexOf(id);
            live.current = {
                id,
                from,
                to: from,
                dy: 0,
                startY: event.clientY,
                tops: rects.map((rect) => rect.top),
                heights: rects.map((rect) => rect.height),
            };
            setDrag(live.current);
        },
        onPointerMove: (event) => {
            const current = live.current;
            if (!current) return;

            const { from, tops, heights, startY } = current;
            // No further than the first row's place or the last one's
            const highest = tops[0] - tops[from];
            const lowest = tops.at(-1) + heights.at(-1) - (tops[from] + heights[from]);
            const dy = Math.min(Math.max(event.clientY - startY, highest), lowest);
            // Its new place: after every other row whose middle it has passed
            const middle = tops[from] + heights[from] / 2 + dy;
            const to = tops.filter(
                (top, index) => index !== from && top + heights[index] / 2 < middle,
            ).length;

            live.current = { ...current, dy, to };
            setDrag(live.current);
        },
        onPointerUp: () => finish(true),
        onPointerCancel: () => finish(false),
        onKeyDown: (event) => {
            const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
            if (!step) return;

            event.preventDefault();
            const from = ids.indexOf(id);
            const to = from + step;
            if (to < 0 || to >= ids.length) return;

            onReorder(moveWithin(ids, from, to), { id, to });
            // The row is moved in the page, which takes the focus off its handle: give it back
            requestAnimationFrame(() =>
                document.querySelector(`[data-reorder="${id}"] [data-reorder-handle]`)?.focus(),
            );
        },
    });

    const rowStyle = (id) => {
        if (!drag) return undefined;

        const index = ids.indexOf(id);
        const { from, to, dy, heights } = drag;
        let shift = 0;

        if (index === from) shift = dy;
        else if (from < index && index <= to) shift = -heights[from];
        else if (to <= index && index < from) shift = heights[from];

        return shift ? { transform: `translateY(${shift}px)` } : undefined;
    };

    return { handleProps, rowStyle, dragging: drag?.id ?? null, settling };
};

export default useReorder;
