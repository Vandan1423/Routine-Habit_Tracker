import {
    ExpensesPage,
    GoalsPage,
    HistoryPage,
    InsightsPage,
    ItemPage,
    PlanPage,
    SettingsPage,
    TodayPage,
    TodoPage,
    TrashPage,
} from "../../routes/pages";
import { GOALS_PATH, TODO_PATH, TRASH_PATH } from "../../lib/places";

/**
 * The screens the navigation leads to, in the order they are shown.
 *
 * path: where it lives. Anything under it counts as being there.
 * icon: a name from the app's icon set
 * key: the letter that goes there from the keyboard, pressed after G (see lib/shortcuts.js)
 * group: which run of the sidebar it sits in: what is done (1), what is looked back on (2), the rest (3).
 *        A gap separates one group from the next.
 * primary: has a place of its own in the phone's tab bar. The others sit under "More" there.
 * preload: starts downloading the screen, called when its link is hovered or focused
 */
export const DESTINATIONS = [
    { id: "today", label: "Today", path: "/today", icon: "today", key: "t", group: 1, primary: true, preload: TodayPage.preload },
    {
        id: "plan",
        label: "Plan",
        path: "/plan",
        icon: "plan",
        key: "p",
        group: 1,
        primary: true,
        preload: () => {
            PlanPage.preload();
            ItemPage.preload();
        },
    },
    { id: "todo", label: "To-do", path: TODO_PATH, icon: "todo", key: "d", group: 1, primary: true, preload: TodoPage.preload },
    { id: "goals", label: "Goals", path: GOALS_PATH, icon: "goal", key: "g", group: 1, primary: false, preload: GoalsPage.preload },
    {
        id: "insights",
        label: "Insights",
        path: "/insights",
        icon: "insights",
        key: "i",
        group: 2,
        primary: true,
        preload: InsightsPage.preload,
    },
    {
        id: "history",
        label: "History",
        path: "/history",
        icon: "history",
        key: "h",
        group: 2,
        primary: false,
        preload: HistoryPage.preload,
    },
    {
        id: "expenses",
        label: "Expenses",
        path: "/expenses",
        icon: "expenses",
        key: "e",
        group: 2,
        primary: false,
        preload: ExpensesPage.preload,
    },
    { id: "trash", label: "Trash", path: TRASH_PATH, icon: "trash", key: "r", group: 3, primary: false, preload: TrashPage.preload },
    {
        id: "settings",
        label: "Settings",
        path: "/settings",
        icon: "settings",
        key: "s",
        group: 3,
        primary: false,
        preload: SettingsPage.preload,
    },
];

export const HOME_PATH = "/today";

const isUnder = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

// The destination an address belongs to, if any
export const destinationFor = (pathname) =>
    DESTINATIONS.find((destination) => isUnder(pathname, destination.path));

// Addresses that are shown on their own, with no navigation around them
// Only for a visitor who is not signed in; anyone signed in is sent on from them
const SIGNED_OUT_PATHS = ["/login", "/signup"];
// Pages that read nothing of the account: a link from an email, the privacy note
const OPEN_PATHS = ["/forgot-password", "/reset-password", "/verify-email", "/privacy"];
const STANDALONE_PATHS = [...SIGNED_OUT_PATHS, ...OPEN_PATHS, "/dev"];

const isAmong = (paths, pathname) => paths.some((path) => isUnder(pathname, path));

export const isStandalonePath = (pathname) => isAmong(STANDALONE_PATHS, pathname);

/**
 * Whether the page at an address has to wait for the session check (see AuthProvider).
 * An open page never does. The sign-in and sign-up forms wait only when this browser holds a session
 * from last time, which the check will most likely confirm and send onward; with none held there is
 * almost never one to find, so the form is shown at once and the visitor can start typing while the
 * server, which may have been asleep, answers.
 */
export const needsSession = (pathname, signedIn) => {
    if (isAmong(OPEN_PATHS, pathname)) return false;
    if (isAmong(SIGNED_OUT_PATHS, pathname)) return signedIn;
    return true;
};

// The addresses from before the redesign, and where each one leads now
export const OLD_PATHS = [
    ["/dashboard", "/today"],
    ["/routine", "/plan"],
    ["/habits", "/plan"],
    // The two halves Plan had while it was being rebuilt
    ["/plan/routines", "/plan"],
    ["/plan/habits", "/plan"],
    ["/progress", "/insights"],
];
