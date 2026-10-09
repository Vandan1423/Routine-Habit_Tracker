import { useCallback, useEffect, useState } from "react";

// How long a finished day stays open before it folds away: long enough for the last block's own moment to play
const FOLD_AFTER_MS = 900;

const NONE_CHOSEN = {};

/**
 * Which parts of the day are folded away.
 * A block is open unless its heading has been pressed, with one exception: when the whole day is finished
 * (and the server has taken the last tick), its blocks fold themselves away, a beat later. That is how the
 * screen says the day is closed. A day that loads already finished is folded from the start.
 * A choice made by pressing a heading wins over both, and is remembered for that day.
 *
 * Call it from a component that mounts once the day has loaded.
 * memory, setMemory: what this browser remembers about Today (see useRemembered); folds are kept under `folds`
 * Returns { isFolded(block), fold(block, folded) }.
 */
const useDayFolds = (day, date, memory, setMemory) => {
    const [closed, setClosed] = useState(day.sealed);

    // Something was reopened: the day opens up again at once
    if (!day.sealed && closed) {
        setClosed(false);
    }

    useEffect(() => {
        if (!day.sealed) return undefined;

        const timer = setTimeout(() => setClosed(true), FOLD_AFTER_MS);
        return () => clearTimeout(timer);
    }, [day.sealed]);

    const chosen = memory.folds?.date === date ? memory.folds.blocks : NONE_CHOSEN;

    const isFolded = (block) => chosen[block.id] ?? (closed && block.sealed);

    const fold = useCallback(
        (block, folded) =>
            setMemory((current) => ({
                ...current,
                folds: {
                    date,
                    blocks: {
                        ...(current.folds?.date === date ? current.folds.blocks : NONE_CHOSEN),
                        [block.id]: folded,
                    },
                },
            })),
        [date, setMemory],
    );

    return { isFolded, fold };
};

export default useDayFolds;
