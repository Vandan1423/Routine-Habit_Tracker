import { lazy, Suspense, useEffect, useState } from "react";

const Editor = lazy(() => import("./ItemEditor"));

// How long after a screen appears the form's code is fetched, if nothing has asked for it sooner
const IDLE_MS = 1200;

/**
 * ItemEditor, downloaded apart from the screen that opens it: the form and its pickers are not needed
 * to show a day. It is fetched a moment after the screen appears, so that it is already in place,
 * closed, by the time something opens it; asked for sooner than that, it is fetched at once.
 * Takes what ItemEditor takes, and:
 * ahead: false leaves the form unfetched until it is asked for, where opening it is the exception
 */
const LazyItemEditor = ({ ahead = true, ...props }) => {
    const [wanted, setWanted] = useState(false);

    if (props.request && !wanted) {
        setWanted(true);
    }

    useEffect(() => {
        if (!ahead) return undefined;

        const timer = setTimeout(() => setWanted(true), IDLE_MS);
        return () => clearTimeout(timer);
    }, [ahead]);

    if (!wanted) return null;

    return (
        <Suspense fallback={null}>
            <Editor {...props} />
        </Suspense>
    );
};

export default LazyItemEditor;
