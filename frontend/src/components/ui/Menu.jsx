import { Menu as BaseMenu } from "@base-ui/react/menu";
import Icon from "./Icon";
import Kbd from "./Kbd";
import { cx } from "../../lib/cx";
import styles from "./Menu.module.css";

/**
 * A list of actions that opens from a button.
 * The arrow keys move through it, typing a letter jumps to a match, Enter chooses, Esc closes,
 * and focus returns to the button.
 *
 * trigger: the button that opens it, usually an <IconButton> or a <Button>
 * side, align: where it opens against the trigger ("bottom" and "start" unless given). It moves if there is no room.
 * Build it from the parts below: Menu.Item, Menu.Separator, Menu.Group, Menu.RadioGroup, Menu.RadioItem, Menu.CheckboxItem.
 */
const Menu = ({
    trigger,
    side = "bottom",
    align = "start",
    open,
    onOpenChange,
    className,
    children,
}) => (
    <BaseMenu.Root open={open} onOpenChange={onOpenChange}>
        <BaseMenu.Trigger render={trigger} />
        <BaseMenu.Portal>
            <BaseMenu.Positioner
                className={styles.positioner}
                side={side}
                align={align}
                sideOffset={6}
                collisionPadding={8}
            >
                <BaseMenu.Popup className={cx(styles.popup, className)}>{children}</BaseMenu.Popup>
            </BaseMenu.Positioner>
        </BaseMenu.Portal>
    </BaseMenu.Root>
);

// What every kind of row shows: an icon, the text, and something at the end
const RowContent = ({ icon, end, children }) => (
    <>
        {icon && <Icon name={icon} className={styles.rowIcon} />}
        <span className={styles.rowText}>{children}</span>
        {end && <span className={styles.rowEnd}>{end}</span>}
    </>
);

/**
 * One action.
 * onSelect: runs when it is chosen, by pointer or keyboard
 * icon: an icon name. shortcut: the keys that do the same thing, such as "mod+d"
 * tone: "danger" for an action that removes something
 */
const Item = ({ icon, shortcut, tone, onSelect, className, children, ...rest }) => (
    <BaseMenu.Item
        className={cx(styles.row, tone === "danger" && styles.danger, className)}
        onClick={onSelect}
        {...rest}
    >
        <RowContent icon={icon} end={shortcut && <Kbd keys={shortcut} />}>
            {children}
        </RowContent>
    </BaseMenu.Item>
);

const Separator = () => <BaseMenu.Separator className={styles.separator} />;

// Rows that belong together, under a quiet heading
const Group = ({ label, children }) => (
    <BaseMenu.Group>
        <BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>
        {children}
    </BaseMenu.Group>
);

// A choice of one, inside a menu: value, onChange(value), and a Menu.RadioItem for each option
const RadioGroup = ({ value, onChange, label, children }) => (
    <BaseMenu.RadioGroup value={value} onValueChange={onChange}>
        {label && <BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>}
        {children}
    </BaseMenu.RadioGroup>
);

const tick = <Icon name="check" className={styles.tick} />;

// The menu stays open when one is chosen, so the change can be seen
const RadioItem = ({ value, icon, className, children, ...rest }) => (
    <BaseMenu.RadioItem value={value} className={cx(styles.row, className)} {...rest}>
        <RowContent
            icon={icon}
            end={<BaseMenu.RadioItemIndicator keepMounted>{tick}</BaseMenu.RadioItemIndicator>}
        >
            {children}
        </RowContent>
    </BaseMenu.RadioItem>
);

// An on/off setting inside a menu: checked, onChange(checked)
const CheckboxItem = ({ checked, onChange, icon, className, children, ...rest }) => (
    <BaseMenu.CheckboxItem
        checked={checked}
        onCheckedChange={onChange}
        className={cx(styles.row, className)}
        {...rest}
    >
        <RowContent
            icon={icon}
            end={
                <BaseMenu.CheckboxItemIndicator keepMounted>{tick}</BaseMenu.CheckboxItemIndicator>
            }
        >
            {children}
        </RowContent>
    </BaseMenu.CheckboxItem>
);

Menu.Item = Item;
Menu.Separator = Separator;
Menu.Group = Group;
Menu.RadioGroup = RadioGroup;
Menu.RadioItem = RadioItem;
Menu.CheckboxItem = CheckboxItem;

export default Menu;
