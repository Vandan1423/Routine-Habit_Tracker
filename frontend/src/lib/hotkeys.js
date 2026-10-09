// Keyboard shortcuts, heard in one place.
//
// A shortcut is written the way lib/shortcuts.js lists it: "mod+k" (⌘ on a Mac, Ctrl elsewhere),
// "?" or "j" for a single key, and "g t" for two keys pressed one after the other.
// Whoever wants keys calls bindHotkeys with a set of them; the set bound last is asked first.
//
// What is never taken from the reader: a key typed into a field (only "mod+" shortcuts work there),
// anything pressed while a dialog or a menu is open or on its way, and anything held with Alt or the
// platform's other modifier.

import { isApplePlatform } from "./platform";

// How long the first key of a pair waits for the second
const SEQUENCE_MS = 1200;

const layers = [];
let pending = null; // the first key of a pair, while it waits
let pendingTimer;
let apple = false;

// Types that take text. A checkbox or a button is an <input> too, and keys pressed on one are ours to use.
const TEXT_INPUTS = new Set([
    "text", "search", "email", "password", "number", "tel", "url", "date", "time", "datetime-local", "month", "week",
]);

const takesText = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.isContentEditable) return true;

    const tag = element.tagName;
    return tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && TEXT_INPUTS.has(element.type));
};

const OVERLAYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

// Something has opened over the page: focus is inside it, or (for the moment before focus has moved in)
// the page behind it has been set aside. Base UI marks what a modal sets aside with data-base-ui-inert.
const overlayOpen = (element) =>
    (element instanceof Element && Boolean(element.closest(OVERLAYS))) ||
    Boolean(document.querySelector("[data-base-ui-inert]"));

// Raised by whoever knows that something is about to open before it is on the page (see holdHotkeys)
let held = 0;

/**
 * The name a key press goes by, or null for one that is never a shortcut.
 * Shift is named only where it changes nothing else: "shift+enter", but "?" rather than "shift+/".
 */
export const describeKey = (event, onApple = apple) => {
    const mod = onApple ? event.metaKey : event.ctrlKey;
    const other = onApple ? event.ctrlKey : event.metaKey;

    if (other || event.altKey) return null;

    const key = event.key === " " ? "space" : event.key.toLowerCase();
    if (["shift", "control", "meta", "alt", "dead", "unidentified"].includes(key)) return null;

    const shift = event.shiftKey && (key.length > 1 || /^[a-z]$/.test(key));
    return `${mod ? "mod+" : ""}${shift ? "shift+" : ""}${key}`;
};

const forget = () => {
    pending = null;
    clearTimeout(pendingTimer);
};

const find = (name) => {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
        if (layers[index][name]) return layers[index][name];
    }
    return null;
};

const startsPair = (name) => layers.some((layer) => Object.keys(layer).some((key) => key.startsWith(`${name} `)));

const handleKeyDown = (event) => {
    if (event.defaultPrevented || event.isComposing) return;

    const name = describeKey(event);
    if (!name) return;

    const plain = !name.startsWith("mod+");
    if (held > 0 || overlayOpen(event.target) || (plain && takesText(event.target))) {
        forget();
        return;
    }

    const first = pending;
    forget();

    const handler = find(first ? `${first} ${name}` : name);
    if (handler) {
        // A handler that answers false did not want the key after all, and the browser keeps it
        if (handler(event) !== false) event.preventDefault();
        return;
    }

    // Held down, the first key of a pair would start again and again
    if (!first && plain && !event.repeat && startsPair(name)) {
        pending = name;
        pendingTimer = setTimeout(forget, SEQUENCE_MS);
        event.preventDefault();
    }
};

/**
 * Starts listening for a set of shortcuts: { "mod+k": handler, "g t": handler }.
 * Returns the function that stops it.
 */
export const bindHotkeys = (bindings) => {
    if (layers.length === 0) {
        apple = isApplePlatform();
        document.addEventListener("keydown", handleKeyDown);
    }
    layers.push(bindings);

    return () => {
        const index = layers.indexOf(bindings);
        if (index >= 0) layers.splice(index, 1);

        if (layers.length === 0) {
            document.removeEventListener("keydown", handleKeyDown);
            forget();
        }
    };
};

/**
 * Stops every shortcut until the function it returns is called. For the gap between asking for something
 * that opens over the page and its arriving there (its code may still be downloading): what is typed in
 * that gap is meant for it, not for the page behind.
 */
export const holdHotkeys = () => {
    held += 1;
    forget();

    let released = false;
    return () => {
        if (released) return;
        released = true;
        held -= 1;
    };
};
