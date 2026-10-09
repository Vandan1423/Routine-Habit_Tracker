import { useSyncExternalStore } from "react";
import { readRemembered, remember } from "../lib/remembered";

// Whether the sidebar has been folded down to its rail of icons, on a screen wide enough to show it whole.
// Held outside any component, because the shell draws it and the command menu, which sits around the shell,
// offers to change it. This browser remembers the choice.

const NAME = "sidebar.collapsed";

let collapsed = readRemembered(NAME, false) === true;
const listeners = new Set();

const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const setSidebarCollapsed = (next) => {
    const value = typeof next === "function" ? next(collapsed) : next;
    if (value === collapsed) return;

    collapsed = value;
    remember(NAME, collapsed);
    for (const listener of listeners) listener();
};

export const toggleSidebar = () => setSidebarCollapsed((current) => !current);

// Returns [collapsed, toggle]
const useSidebar = () => [useSyncExternalStore(subscribe, () => collapsed), toggleSidebar];

export default useSidebar;
