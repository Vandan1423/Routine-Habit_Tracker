import { createElement, lazy, useState } from "react";

/**
 * A screen whose code is downloaded only when it is first needed.
 *   const InsightsPage = lazyPage(() => import("../pages/Progress/ProgressPage"));
 *
 * `InsightsPage.preload()` starts the download early (the navigation calls it when a link is hovered
 * or focused), so the screen is usually ready by the time it is asked for.
 */
export const lazyPage = (load) => {
    let Loaded = null;
    let pending = null;

    const preload = () => {
        pending ??= load().then((module) => {
            Loaded = module.default;
            return module;
        });
        // A failed download (offline, or a new version replaced the file) may be tried again
        pending.catch(() => {
            pending = null;
        });
        return pending;
    };

    const Lazy = lazy(preload);

    const Page = (props) => {
        // Already downloaded: render it straight away, with no loading state in between.
        // Chosen once for as long as the screen is mounted, so a later render can never swap one for the other and remount it.
        const [Component] = useState(() => Loaded ?? Lazy);

        return createElement(Component, props);
    };

    Page.preload = preload;
    return Page;
};
