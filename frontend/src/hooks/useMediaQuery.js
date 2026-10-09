import { useCallback, useSyncExternalStore } from "react";

// True while a CSS media query matches, and re-renders when that changes
const useMediaQuery = (query) => {
    const subscribe = useCallback(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        [query],
    );

    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
};

export default useMediaQuery;
