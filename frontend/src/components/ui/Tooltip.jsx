import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import Kbd from "./Kbd";
import styles from "./Tooltip.module.css";

/**
 * A short label that appears when a control is hovered or focused with the keyboard: the name of an
 * icon button, and the keys that do the same thing.
 * It never shows on touch and screen readers do not read it, so the control still needs its own label
 * (an IconButton has one), and nothing important may live only here.
 *
 * label: the text, a word or two. shortcut: keys such as "mod+k"
 * side: "top" unless given. It moves if there is no room.
 * disabled: never shows, for a control whose name is already written beside it
 * children: the one control it describes
 */
const Tooltip = ({ label, shortcut, side = "top", align = "center", disabled = false, children }) => (
    <BaseTooltip.Root disableHoverablePopup disabled={disabled}>
        <BaseTooltip.Trigger render={children} />
        <BaseTooltip.Portal>
            <BaseTooltip.Positioner
                className={styles.positioner}
                side={side}
                align={align}
                sideOffset={6}
                collisionPadding={8}
            >
                <BaseTooltip.Popup className={styles.popup}>
                    {label}
                    {shortcut && <Kbd keys={shortcut} />}
                </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
    </BaseTooltip.Root>
);

// Wraps the app once. After one tooltip has shown, its neighbours show at once instead of waiting again.
export const TooltipProvider = ({ children }) => (
    <BaseTooltip.Provider delay={500} closeDelay={0}>
        {children}
    </BaseTooltip.Provider>
);

export default Tooltip;
