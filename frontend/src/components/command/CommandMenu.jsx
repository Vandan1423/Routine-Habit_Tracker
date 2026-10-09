import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { DESTINATIONS } from "../shell/navigation";
import { Icon, Kbd } from "../ui";
import useAppearance from "../../hooks/useAppearance";
import useAuth from "../../hooks/useAuth";
import useMediaQuery from "../../hooks/useMediaQuery";
import usePlan from "../../hooks/usePlan";
import useSidebar from "../../hooks/useSidebar";
import useToday from "../../hooks/useToday";
import useTodos from "../../hooks/useTodos";
import { THEME_OPTIONS } from "../../lib/appearance";
import { buildCommands, searchCommands } from "../../lib/commands";
import { cx } from "../../lib/cx";
import { buildDay } from "../../lib/day";
import { describeKey } from "../../lib/hotkeys";
import { KEYS } from "../../lib/shortcuts";
import { openTodos } from "../../lib/todos";
import dialog from "../ui/Dialog.module.css";
import styles from "./CommandMenu.module.css";

/**
 * The field and the list, alive only while the menu is open: each opening starts from an empty field
 * and from the day as it stands at that moment.
 */
const Commands = ({ onClose, onNew, onNewTodo, onShortcuts }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const today = useToday();
    const plan = usePlan();
    const { theme, setTheme, motion, setMotion } = useAppearance();
    const { logout } = useAuth();
    const todos = useTodos();
    const isDesktop = useMediaQuery("(min-width: 1100px)"); // bp: desktop
    const [folded, toggleSidebar] = useSidebar();
    const [query, setQuery] = useState("");
    const [now] = useState(() => new Date());

    const { ensure: ensureToday } = today;
    const { ensure: ensurePlan } = plan;
    const { ensure: ensureTodos } = todos;
    // Completing by name needs today's list, opening an item needs the plan, and ticking a to-do needs
    // the lists, whichever screen this opened over
    useEffect(() => {
        ensureToday();
        ensurePlan();
        ensureTodos();
    }, [ensureToday, ensurePlan, ensureTodos]);

    const { status, routines, habits, pending } = today;
    const day = useMemo(
        () => (status === "ready" ? buildDay({ routines, habits, now, pending }) : null),
        [status, routines, habits, now, pending],
    );

    const planned = plan.routines;
    const items = useMemo(
        () => [
            ...planned.map((routine) => ({ kind: "routine", id: routine._id, title: routine.title })),
            ...habits.map((habit) => ({ kind: "habit", id: habit._id, title: habit.title })),
        ],
        [planned, habits],
    );

    const open = useMemo(() => openTodos(todos.lists), [todos.lists]);

    const commands = useMemo(
        () =>
            buildCommands({
                destinations: DESTINATIONS,
                pathname,
                day,
                items,
                todos: open,
                themes: THEME_OPTIONS,
                theme,
                motion,
                sidebar: isDesktop ? { folded } : null,
            }),
        [pathname, day, items, open, theme, motion, isDesktop, folded],
    );
    const groups = useMemo(() => searchCommands(commands, query), [commands, query]);

    const run = ({ action }) => {
        onClose();

        if (action.type === "go") {
            navigate(action.path, action.state ? { state: action.state } : undefined);
        } else if (action.type === "new") {
            onNew(action.request);
        } else if (action.type === "complete") {
            const { item } = action;

            if (item.kind === "routine") {
                today.setRoutineDone(item.id, true);
            } else {
                // As a tick on Today does: a counted habit is filled to its target
                today.setHabitQuantity(item.id, item.counted ? item.target : 1);
            }
        } else if (action.type === "new-todo") {
            onNewTodo();
        } else if (action.type === "todo-done") {
            todos.setDone(action.todo, true);
        } else if (action.type === "sidebar") {
            toggleSidebar();
        } else if (action.type === "theme") {
            setTheme(action.value);
        } else if (action.type === "motion") {
            setMotion(action.value);
        } else if (action.type === "shortcuts") {
            onShortcuts();
        } else if (action.type === "sign-out") {
            logout();
        }
    };

    return (
        <Autocomplete.Root
            open
            inline
            items={groups}
            filter={null}
            value={query}
            onValueChange={(next, details) => {
                // Choosing a command must not write its name into the field as the menu closes
                if (details.reason !== "item-press") setQuery(next);
            }}
            itemToStringValue={(command) => command.label}
            autoHighlight="always"
            keepHighlight
        >
            <label className={styles.search}>
                <Icon name="search" className={styles.searchIcon} />
                <Autocomplete.Input
                    className={styles.input}
                    placeholder="Go to, add, or complete something"
                    aria-label="Search commands"
                    autoComplete="off"
                    spellCheck={false}
                />
            </label>
            <BaseDialog.Close className="visually-hidden">Close the command menu</BaseDialog.Close>

            <Autocomplete.Empty>
                <p className={styles.empty}>Nothing answers to “{query.trim()}”.</p>
            </Autocomplete.Empty>
            <Autocomplete.List className={styles.list}>
                {(group) => (
                    <Autocomplete.Group key={group.id} items={group.items} className={styles.group}>
                        <Autocomplete.GroupLabel className={styles.groupLabel}>
                            {group.value}
                        </Autocomplete.GroupLabel>
                        <Autocomplete.Collection>
                            {(command) => (
                                <Autocomplete.Item
                                    key={command.id}
                                    value={command}
                                    className={styles.row}
                                    onClick={() => run(command)}
                                >
                                    <Icon name={command.icon} className={styles.rowIcon} />
                                    <span className={styles.rowText}>
                                        {command.label}
                                        {command.detail && (
                                            <span className={styles.detail}>{command.detail}</span>
                                        )}
                                    </span>
                                    {(command.end || command.keys || command.checked) && (
                                        <span className={styles.rowEnd}>
                                            {command.checked && <Icon name="check" className={styles.tick} />}
                                            {command.end}
                                            {command.keys && <Kbd keys={command.keys} />}
                                        </span>
                                    )}
                                </Autocomplete.Item>
                            )}
                        </Autocomplete.Collection>
                    </Autocomplete.Group>
                )}
            </Autocomplete.List>

            <p className={styles.foot} aria-hidden="true">
                <span>
                    <Kbd keys="arrowup" /> <Kbd keys="arrowdown" /> to move
                </span>
                <span>
                    <Kbd keys="enter" /> to choose
                </span>
                <span>
                    <Kbd keys="escape" /> to close
                </span>
            </p>
        </Autocomplete.Root>
    );
};

/**
 * The command menu: one field over a short list of what can be done from anywhere. Go to a screen,
 * add something, complete one of today's items by name, open an item's page, change how the app looks.
 * Typing narrows the list (lib/commands.js); the arrow keys move through it and Enter chooses.
 *
 * open, onOpenChange(open): whether it is showing
 * onNew(request): a command asked for the form (see ItemEditor)
 * onNewTodo(): a command asked for the line a to-do is written on
 * onShortcuts(): a command asked for the list of shortcuts
 */
const CommandMenu = ({ open, onOpenChange, onNew, onNewTodo, onShortcuts }) => (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
        <BaseDialog.Portal>
            <BaseDialog.Backdrop className={dialog.backdrop} />
            <BaseDialog.Viewport className={dialog.viewport}>
                <BaseDialog.Popup
                    className={cx(dialog.popup, dialog.panel, dialog.lg, styles.menu)}
                    aria-label="Command menu"
                    onKeyDown={(event) => {
                        // The keys that opened it also put it away
                        if (describeKey(event) === KEYS.menu) {
                            event.preventDefault();
                            onOpenChange(false);
                        }
                    }}
                >
                    <Commands
                        onClose={() => onOpenChange(false)}
                        onNew={onNew}
                        onNewTodo={onNewTodo}
                        onShortcuts={onShortcuts}
                    />
                </BaseDialog.Popup>
            </BaseDialog.Viewport>
        </BaseDialog.Portal>
    </BaseDialog.Root>
);

export default CommandMenu;
