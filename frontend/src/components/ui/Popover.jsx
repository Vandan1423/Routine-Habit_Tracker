import { Popover as BasePopover } from "@base-ui/react/popover";
import { cx } from "../../lib/cx";
import styles from "./Popover.module.css";

/**
 * A small panel that opens beside a button, for something that needs more room than a menu row:
 * a few controls, a short explanation. Esc or a press outside closes it, and focus returns to the button.
 *
 * trigger: the button that opens it
 * title, description: optional text at the top; they also name the panel for screen readers
 * side, align: where it opens against the trigger ("bottom" and "start" unless given). It moves if there is no room.
 * open, onOpenChange(open): only when something else has to open or close it
 * initialFocus: a ref to, or a function returning, what is focused when it opens. Without one, it is the first control inside.
 */
const Popover = ({
    trigger,
    title,
    description,
    side = "bottom",
    align = "start",
    open,
    onOpenChange,
    initialFocus,
    className,
    children,
}) => (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
        <BasePopover.Trigger render={trigger} />
        <BasePopover.Portal>
            <BasePopover.Positioner
                className={styles.positioner}
                side={side}
                align={align}
                sideOffset={6}
                collisionPadding={8}
            >
                <BasePopover.Popup className={cx(styles.popup, className)} initialFocus={initialFocus}>
                    {title && <BasePopover.Title className={styles.title}>{title}</BasePopover.Title>}
                    {description && (
                        <BasePopover.Description className={styles.description}>
                            {description}
                        </BasePopover.Description>
                    )}
                    {children}
                </BasePopover.Popup>
            </BasePopover.Positioner>
        </BasePopover.Portal>
    </BasePopover.Root>
);

// A button inside the panel that closes it: <Popover.Close render={<Button>Done</Button>} />
Popover.Close = BasePopover.Close;

export default Popover;
