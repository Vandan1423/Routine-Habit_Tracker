import { createContext } from "react";

const nothing = () => {};

// What the shell's command layer offers the screens inside it (see CommandLayer and hooks/useCommands.js).
// The shell is also drawn while the session is still being checked, before there is a layer:
// until then its buttons are there and open nothing.
const CommandContext = createContext({
    openMenu: nothing,
    preloadMenu: nothing,
    openShortcuts: nothing,
    openEditor: nothing,
    openTodo: nothing,
});

export default CommandContext;
