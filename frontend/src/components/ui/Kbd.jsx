import { Fragment } from "react";
import { cx } from "../../lib/cx";
import { isApplePlatform } from "../../lib/platform";
import styles from "./Kbd.module.css";

// How each platform writes the keys that differ between them, and how both write the ones with long names
const SHARED_NAMES = { arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", space: "Space", escape: "Esc" };
const KEY_NAMES = {
    apple: { ...SHARED_NAMES, mod: "⌘", alt: "⌥", shift: "⇧", enter: "↵", backspace: "⌫" },
    other: { ...SHARED_NAMES, mod: "Ctrl", alt: "Alt", shift: "Shift", enter: "Enter", backspace: "Backspace" },
};

/**
 * A keyboard key, as shown beside the action it triggers.
 * keys: a shortcut such as "mod+k", written the way this platform writes it (⌘K on a Mac, Ctrl K elsewhere).
 *       Two keys pressed one after the other are written with a space, "g t", and shown as "G then T".
 * Or pass the text to show as children.
 * It is not shown on a device with nothing to press: a phone or a tablet without a keyboard.
 */
const Kbd = ({ keys, className, children }) => {
    if (!keys) {
        return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
    }

    const apple = isApplePlatform();
    const names = apple ? KEY_NAMES.apple : KEY_NAMES.other;

    // A lone "+" is the plus key itself, not two keys held together
    const write = (combination) =>
        (combination === "+" ? [combination] : combination.split("+"))
            .map((key) => names[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key))
            .join(apple ? "" : " ");

    const steps = keys.split(" ");

    if (steps.length === 1) {
        return <kbd className={cx(styles.kbd, className)}>{write(keys)}</kbd>;
    }

    return (
        <span className={cx(styles.sequence, className)}>
            {steps.map((step, index) => (
                <Fragment key={step + index}>
                    {index > 0 && <span className={styles.then}>then</span>}
                    <kbd className={styles.kbd}>{write(step)}</kbd>
                </Fragment>
            ))}
        </span>
    );
};

export default Kbd;
