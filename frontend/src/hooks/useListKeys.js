import useHotkeys from "./useHotkeys";
import { KEYS } from "../lib/shortcuts";

// A row of a list is whatever carries data-item (DayRow and PlanRow do). Its main control takes the focus:
// the check on Today, the name on Plan and on a day that is over.
const ROW = "[data-item]";
const MAIN = 'input[type="checkbox"], a[href]';

// The rows that can be reached: not inside a folded block, and not on their way out
const rowsOnScreen = () =>
    [...document.querySelectorAll(ROW)].filter((row) => !row.closest("[inert]") && row.getClientRects().length > 0);

const currentRow = () => document.activeElement?.closest?.(ROW) ?? null;

export const focusRow = (row) => {
    const target = row?.querySelector(MAIN) ?? row?.querySelector("button, [tabindex]");
    if (!target) return;

    target.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest" });
};

/**
 * Moving through a list of rows from the keyboard, and acting on the row that holds the focus.
 * J and K (or the arrows, once a row is focused) move down and up. Focus itself is the cursor, so the
 * row's own ring shows where it is and Tab carries on from there.
 *
 * actions: { [shortcut]: (key, row, neighbour) => … }, each called with the focused row's data-item,
 *          the row itself, and the row that would take its place if it went. Return false to leave the key alone.
 * enabled: false while there is no list
 */
const useListKeys = (actions = {}, enabled = true) => {
    const move = (step) => () => {
        const rows = rowsOnScreen();
        if (rows.length === 0) return false;

        const index = rows.indexOf(currentRow());
        // With no row focused yet, down starts at the top and up at the bottom
        const next = index < 0 ? (step > 0 ? 0 : rows.length - 1) : index + step;

        if (rows[next]) focusRow(rows[next]);
        return true;
    };

    // Until a row has the focus the arrows still scroll the page
    const arrow = (step) => () => (currentRow() ? move(step)() : false);

    const onRow = (action) => (event) => {
        const row = currentRow();
        if (!row) return false;

        const rows = rowsOnScreen();
        const index = rows.indexOf(row);
        return action(row.dataset.item, row, rows[index + 1] ?? rows[index - 1] ?? null, event);
    };

    useHotkeys(
        {
            [KEYS.down]: move(1),
            [KEYS.up]: move(-1),
            arrowdown: arrow(1),
            arrowup: arrow(-1),
            ...Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, onRow(action)])),
        },
        enabled,
    );
};

export default useListKeys;
