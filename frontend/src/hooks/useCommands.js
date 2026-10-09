import { useContext } from "react";
import CommandContext from "../components/command/CommandContext";

/**
 * The things that open over any screen inside the shell:
 *   openMenu(): the command menu. preloadMenu(): fetch its code ahead, for a button about to be pressed.
 *   openShortcuts(): the list of keyboard shortcuts
 *   openEditor(request): the form a routine or a habit is made in (see ItemEditor)
 *   openTodo(): the line a to-do is written on
 */
const useCommands = () => useContext(CommandContext);

export default useCommands;
