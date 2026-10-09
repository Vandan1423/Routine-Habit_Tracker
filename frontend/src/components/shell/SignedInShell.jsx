import { lazy, Suspense } from "react";
import Shell from "./Shell";
import CommandLayer from "../command/CommandLayer";

// Arrives just after the shell: its words are not needed to draw anything
const DayNotices = lazy(() => import("./DayNotices"));

/**
 * The shell once someone is known to be signed in, with what only works then: the command menu and the
 * keyboard shortcuts around it, and the notices about today. (While the session is still being checked,
 * the bare Shell is drawn instead: today's data and the plan do not exist yet.)
 * Takes what Shell takes.
 */
const SignedInShell = (props) => (
    <CommandLayer>
        <Suspense fallback={null}>
            <DayNotices />
        </Suspense>
        <Shell {...props} />
    </CommandLayer>
);

export default SignedInShell;
