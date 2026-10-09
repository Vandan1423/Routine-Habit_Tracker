import { useState } from "react";

/**
 * The value, or the last one it had when it is null. For what a dialog shows: while it closes,
 * the thing it was about is already gone, and its words should not vanish ahead of it.
 */
const useLastValue = (value) => {
    const [kept, setKept] = useState(value);

    if (value != null && value !== kept) {
        setKept(value);
    }

    return value ?? kept;
};

export default useLastValue;
