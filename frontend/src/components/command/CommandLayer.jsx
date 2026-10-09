import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CommandContext from "./CommandContext";
import { ItemEditor } from "../plan";
import { DESTINATIONS } from "../shell/navigation";
import useHotkeys from "../../hooks/useHotkeys";
import { NEW_EXPENSE } from "../../lib/expenseLinks";
import { holdHotkeys } from "../../lib/hotkeys";
import { GOALS_PATH, NEW_GOAL } from "../../lib/places";
import { goKey, KEYS } from "../../lib/shortcuts";

const loadMenu = () => import("./CommandMenu");
const CommandMenu = lazy(loadMenu);
const ShortcutsDialog = lazy(() => import("./ShortcutsDialog"));
const QuickTodo = lazy(() => import("./QuickTodo"));

const EXPENSES = DESTINATIONS.find((destination) => destination.id === "expenses");

// How long after the shell appears the menu's code is fetched, so the first ⌘K opens it without a wait
const AHEAD_MS = 2500;

/**
 * What is within reach from every screen inside the shell: the command menu, the list of shortcuts, the
 * form for adding a routine or a habit, and the line a to-do is written on, each opened from the keyboard
 * or through useCommands(). The shortcuts that work anywhere are bound here; the ones for a list belong
 * to its own screen. None of these is downloaded with the shell: each arrives when it is first wanted.
 */
const CommandLayer = ({ children }) => {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    // Once opened, each stays in place (closed) so that it can close gracefully and open at once next time
    const [menuWanted, setMenuWanted] = useState(false);
    const [shortcutsWanted, setShortcutsWanted] = useState(false);
    const [todoOpen, setTodoOpen] = useState(false);
    const [todoWanted, setTodoWanted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(loadMenu, AHEAD_MS);
        return () => clearTimeout(timer);
    }, []);

    // From the moment one of these is asked for until it has closed, no key reaches the page behind it.
    // The menu's code may still be on its way when the first letters of a search are typed.
    const anythingOpen = menuOpen || shortcutsOpen || todoOpen || Boolean(editing);
    useEffect(() => (anythingOpen ? holdHotkeys() : undefined), [anythingOpen]);

    const commands = useMemo(
        () => ({
            openMenu: () => {
                setMenuWanted(true);
                setMenuOpen(true);
            },
            preloadMenu: loadMenu,
            openShortcuts: () => {
                setShortcutsWanted(true);
                setShortcutsOpen(true);
            },
            openEditor: setEditing,
            openTodo: () => {
                setTodoWanted(true);
                setTodoOpen(true);
            },
        }),
        [],
    );

    useHotkeys({
        [KEYS.menu]: commands.openMenu,
        [KEYS.help]: commands.openShortcuts,
        [KEYS.newRoutine]: () => setEditing({ kind: "routine" }),
        [KEYS.newHabit]: () => setEditing({ kind: "habit" }),
        [KEYS.newTask]: () => setEditing({ kind: "routine", once: true }),
        // Its form belongs to the Expenses screen, which opens it on arriving
        [KEYS.newExpense]: () => navigate(EXPENSES.path, { state: NEW_EXPENSE }),
        [KEYS.newTodo]: commands.openTodo,
        // As with an expense: the form is the Goals screen's own
        [KEYS.newGoal]: () => navigate(GOALS_PATH, { state: NEW_GOAL }),
        ...Object.fromEntries(
            DESTINATIONS.map((destination) => [goKey(destination), () => navigate(destination.path)]),
        ),
    });

    return (
        <CommandContext.Provider value={commands}>
            {children}
            <Suspense fallback={null}>
                {menuWanted && (
                    <CommandMenu
                        open={menuOpen}
                        onOpenChange={setMenuOpen}
                        onNew={setEditing}
                        onNewTodo={commands.openTodo}
                        onShortcuts={commands.openShortcuts}
                    />
                )}
                {shortcutsWanted && <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}
                {todoWanted && <QuickTodo open={todoOpen} onOpenChange={setTodoOpen} />}
            </Suspense>
            <ItemEditor ahead={false} request={editing} onClose={() => setEditing(null)} />
        </CommandContext.Provider>
    );
};

export default CommandLayer;
