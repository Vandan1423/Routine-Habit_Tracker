// Every keyboard shortcut the app has, in one place: the keys are bound from here (see lib/hotkeys.js for
// how one is written) and the sheet that lists them reads the same names, so the two cannot drift apart.

export const KEYS = {
    menu: "mod+k",
    help: "?",
    sidebar: "[",

    newRoutine: "n r",
    newHabit: "n h",
    newTask: "n o",
    newExpense: "n e",
    newTodo: "n t",
    newGoal: "n g",

    // In a list of things: Today's rows and Plan's
    down: "j",
    up: "k",
    toggle: "x",
    more: "+",
    less: "-",
    edit: "e",
    remove: "mod+backspace",

    // On a day in History, and on a month of Expenses
    earlier: "arrowleft",
    later: "arrowright",
};

// "g t" goes to Today: G, then the screen's own letter
export const goKey = (destination) => `g ${destination.key}`;

/**
 * What the shortcuts sheet shows: groups of { keys, label }.
 * `keys` holds one shortcut, or several that do the same thing.
 * destinations: the screens (components/shell/navigation.js), each with the letter that goes to it
 */
export const shortcutGroups = (destinations = []) => [
    {
        title: "Anywhere",
        items: [
            { keys: [KEYS.menu], label: "Open the command menu" },
            { keys: [KEYS.help], label: "Show this list" },
            { keys: [KEYS.sidebar], label: "Fold or unfold the sidebar" },
            { keys: [KEYS.newRoutine], label: "New routine" },
            { keys: [KEYS.newHabit], label: "New habit" },
            { keys: [KEYS.newTask], label: "New one-off task" },
            { keys: [KEYS.newExpense], label: "New expense" },
            { keys: [KEYS.newTodo], label: "New to-do" },
            { keys: [KEYS.newGoal], label: "New goal" },
        ],
    },
    {
        title: "Go to",
        items: destinations.map((destination) => ({
            keys: [goKey(destination)],
            label: destination.label,
        })),
    },
    {
        title: "On Today, Plan, To-do and Expenses",
        items: [
            { keys: [KEYS.down, "arrowdown"], label: "Next item" },
            { keys: [KEYS.up, "arrowup"], label: "Previous item" },
            { keys: [KEYS.toggle, "space"], label: "Tick or un-tick, on Today and To-do" },
            { keys: [KEYS.more], label: "One step more of a counted habit" },
            { keys: [KEYS.less], label: "One step less" },
            { keys: [KEYS.edit], label: "Edit, or reword a to-do" },
            { keys: ["enter"], label: "Open its history, on Plan" },
            { keys: [KEYS.remove], label: "Delete, on Plan, To-do and Expenses" },
        ],
    },
    {
        title: "On a day in History",
        items: [
            { keys: [KEYS.earlier], label: "The day before" },
            { keys: [KEYS.later], label: "The day after" },
        ],
    },
    {
        title: "On Expenses",
        items: [
            { keys: [KEYS.earlier], label: "The month before" },
            { keys: [KEYS.later], label: "The month after" },
        ],
    },
];
