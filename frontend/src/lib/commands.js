// What the command menu offers, and how typing narrows it. Everything here is worked out from its arguments:
// the menu itself (components/command) draws the result and carries out whichever command is chosen.
//
// A command is { id, group, label, detail, end, icon, keys, checked, keywords, action }.
// `action` only describes what to do ({ type: "go", path }); nothing here does it.

import { NEW_EXPENSE } from "./expenseLinks";
import { NEW_GOAL } from "./places";
import { goKey, KEYS } from "./shortcuts";
import { formatTimeRange } from "./time";

// The groups, in the order they are listed when nothing has been typed.
// queryOnly: too long a list to show unasked, so it waits for something to be typed
// limit: how many are shown before anything is typed
const GROUPS = [
    { id: "go", title: "Go to" },
    { id: "add", title: "Add" },
    { id: "complete", title: "Complete today", limit: 4 },
    { id: "todo", title: "Tick a to-do", queryOnly: true },
    { id: "open", title: "Open in Plan", queryOnly: true },
    { id: "look", title: "Appearance" },
    { id: "more", title: "More" },
];

// How many of one group a search shows
const MATCH_LIMIT = 6;

const NBSP = " ";
const amountFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const xpFormat = new Intl.NumberFormat();

// What is said beside an item still to do: its hours, or how far a counted habit has got
const progressOf = (item) => {
    if (item.kind === "routine") return formatTimeRange(item.start, item.end);
    if (!item.counted) return "";

    const unit = item.unit ? `${NBSP}${item.unit}` : "";
    return `${amountFormat.format(item.quantity)} of ${amountFormat.format(item.target)}${unit}`;
};

const THEME_WORDS = { light: "Light theme", dark: "Dark theme", system: "Match the system theme" };

/**
 * Every command there is right now.
 *
 * destinations: the screens (see components/shell/navigation.js). pathname: where the reader is.
 * day: today from buildDay, once it has loaded
 * items: everything in the plan, as [{ kind, id, title }]
 * todos: every to-do still open, each with the name of its list (openTodos in lib/todos.js)
 * themes: the themes on offer ([{ value, icon }]), or none where the choice is not offered. theme: the one chosen.
 * motion: "system" or "reduce"
 * sidebar: { folded } where the sidebar can be folded; null where it cannot (a tablet, a phone)
 */
export const buildCommands = ({
    destinations = [],
    pathname = "",
    day = null,
    items = [],
    todos = [],
    themes = [],
    theme,
    motion,
    sidebar = null,
}) => {
    const here = (path) => pathname === path || pathname.startsWith(`${path}/`);

    const go = destinations
        .filter((destination) => !here(destination.path))
        .map((destination) => ({
            id: `go:${destination.id}`,
            group: "go",
            label: destination.label,
            icon: destination.icon,
            keys: goKey(destination),
            keywords: "go to open screen page",
            action: { type: "go", path: destination.path },
        }));

    const add = [
        { id: "routine", label: "New routine", icon: "clock", keys: KEYS.newRoutine, request: { kind: "routine" } },
        { id: "habit", label: "New habit", icon: "repeat", keys: KEYS.newHabit, request: { kind: "habit" } },
        {
            id: "task",
            label: "New one-off task",
            icon: "calendar",
            keys: KEYS.newTask,
            request: { kind: "routine", once: true },
        },
    ].map(({ request, ...command }) => ({
        ...command,
        id: `add:${command.id}`,
        group: "add",
        keywords: "add create make",
        action: { type: "new", request },
    }));

    // Its form belongs to the Expenses screen, which opens it on arriving
    const expenses = destinations.find((destination) => destination.id === "expenses");
    if (expenses) {
        add.push({
            id: "add:expense",
            group: "add",
            label: "New expense",
            icon: "expenses",
            keys: KEYS.newExpense,
            keywords: "add create make log spend money",
            action: { type: "go", path: expenses.path, state: NEW_EXPENSE },
        });
    }

    add.push({
        id: "add:todo",
        group: "add",
        label: "New to-do",
        icon: "todo",
        keys: KEYS.newTodo,
        keywords: "add create make list task todo",
        action: { type: "new-todo" },
    });

    // Its form belongs to the Goals screen, which opens it on arriving
    const goals = destinations.find((destination) => destination.id === "goals");
    if (goals) {
        add.push({
            id: "add:goal",
            group: "add",
            label: "New goal",
            icon: "goal",
            keys: KEYS.newGoal,
            keywords: "add create make set aim target",
            action: { type: "go", path: goals.path, state: NEW_GOAL },
        });
    }

    // What is still open today, the one to turn to first
    const open = (day?.items ?? []).filter((item) => !item.done);
    const nextKey = day?.next?.item.key;
    const complete = [...open.filter((item) => item.key === nextKey), ...open.filter((item) => item.key !== nextKey)].map(
        (item) => ({
            id: `complete:${item.key}`,
            group: "complete",
            label: item.title,
            detail: progressOf(item),
            end: `+${xpFormat.format(item.xp)}${NBSP}XP`,
            icon: "check",
            keywords: "complete done tick finish today",
            action: { type: "complete", item },
        }),
    );

    const ticks = todos.map((todo) => ({
        id: `todo:${todo._id}`,
        group: "todo",
        label: todo.title,
        detail: todo.listLabel,
        icon: "check",
        keywords: "tick done finish to-do todo list",
        action: { type: "todo-done", todo },
    }));

    const history = items.map((item) => ({
        id: `open:${item.kind}:${item.id}`,
        group: "open",
        label: item.title,
        detail: item.kind === "routine" ? "Routine" : "Habit",
        icon: "arrow-right",
        keywords: "open history plan edit",
        action: { type: "go", path: `/plan/${item.kind}/${item.id}` },
    }));

    const look = [
        ...themes.map((option) => ({
            id: `theme:${option.value}`,
            group: "look",
            label: THEME_WORDS[option.value] ?? option.label,
            icon: option.icon,
            checked: option.value === theme,
            keywords: "theme appearance colour color mode",
            action: { type: "theme", value: option.value },
        })),
        {
            id: "motion",
            group: "look",
            label: motion === "reduce" ? "Turn reduced motion off" : "Reduce motion",
            icon: "motion",
            keywords: "motion animation appearance",
            action: { type: "motion", value: motion === "reduce" ? "system" : "reduce" },
        },
    ];
    if (sidebar) {
        look.push({
            id: "sidebar",
            group: "look",
            label: sidebar.folded ? "Unfold the sidebar" : "Fold the sidebar",
            icon: "sidebar",
            keys: KEYS.sidebar,
            keywords: "sidebar collapse expand hide show navigation rail",
            action: { type: "sidebar" },
        });
    }

    const more = [
        {
            id: "shortcuts",
            group: "more",
            label: "Keyboard shortcuts",
            icon: "keyboard",
            keys: KEYS.help,
            keywords: "keys help",
            action: { type: "shortcuts" },
        },
        {
            id: "sign-out",
            group: "more",
            label: "Sign out",
            icon: "sign-out",
            keywords: "log out logout leave account",
            action: { type: "sign-out" },
        },
    ];

    return [...go, ...add, ...complete, ...ticks, ...history, ...look, ...more];
};

// Lower case and without accents, so "cafe" finds "Café"
const fold = (text) =>
    text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase();

// How well one typed word fits a command: best at the start of its name, then at the start of a word in it,
// then anywhere in it, and last in the words it also answers to. 0 when it is nowhere.
const fit = (word, label, keywords) => {
    if (label.startsWith(word)) return 4;
    if (label.includes(` ${word}`)) return 3;
    if (label.includes(word)) return 2;
    return ` ${keywords}`.includes(` ${word}`) ? 1 : 0;
};

/**
 * The commands that answer what has been typed, as the groups the menu lists:
 * [{ id, value: the group's title, items }]. Every typed word has to be found.
 * The group holding the best match comes first, and within a group the best match does.
 */
export const searchCommands = (commands, query = "") => {
    const words = fold(query).split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return GROUPS.filter((group) => !group.queryOnly)
            .map((group) => ({
                id: group.id,
                value: group.title,
                items: commands.filter((command) => command.group === group.id).slice(0, group.limit),
            }))
            .filter((group) => group.items.length > 0);
    }

    const scored = [];
    for (const command of commands) {
        const label = fold(command.label);
        const keywords = fold(command.keywords ?? "");
        let score = 0;

        for (const word of words) {
            const found = fit(word, label, keywords);
            if (found === 0) {
                score = 0;
                break;
            }
            score += found;
        }

        if (score > 0) scored.push({ command, score });
    }

    return GROUPS.map((group, order) => {
        const matches = scored
            .filter(({ command }) => command.group === group.id)
            .sort((a, b) => b.score - a.score)
            .slice(0, MATCH_LIMIT);

        return {
            id: group.id,
            value: group.title,
            items: matches.map(({ command }) => command),
            best: matches[0]?.score ?? 0,
            order,
        };
    })
        .filter((group) => group.items.length > 0)
        .sort((a, b) => b.best - a.best || a.order - b.order)
        .map(({ id, value, items }) => ({ id, value, items }));
};
