import { Fragment } from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import IconButton from "./IconButton";
import useMediaQuery from "../../hooks/useMediaQuery";
import { cx } from "../../lib/cx";
import styles from "./Dialog.module.css";

/**
 * A short task over the page, such as a form. The page behind is dimmed and cannot be used until it closes.
 * On a phone it comes up from the bottom as a sheet, which can also be swiped away.
 * Esc, the close button and a press outside all close it, and focus returns to whatever opened it.
 *
 * open, onOpenChange(open): whether it is showing. Or pass `trigger`, a button that opens it, and leave these out.
 * title: always needed; it is also how screen readers name the dialog. description: one quiet line under it.
 * footer: the actions, usually a cancel and one primary button.
 * size: "sm", "md" (the default) or "lg"
 * presentation: "auto" (the default: a sheet on a phone, a panel otherwise), "panel" or "sheet"
 * dismissible: false keeps a press outside from closing it, for a form that would lose what was typed
 * initialFocus: a ref to what should be focused first. Without one, it is the first control inside.
 * For a yes-or-no question, use ConfirmDialog.
 */
const Dialog = ({
    open,
    defaultOpen,
    onOpenChange,
    trigger,
    title,
    description,
    footer,
    size = "md",
    presentation = "auto",
    dismissible = true,
    initialFocus,
    className,
    children,
}) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone
    const asSheet = presentation === "sheet" || (presentation === "auto" && isPhone);

    // The two share their parts by name. The drawer adds the swipe, and keeps a focused field above the keyboard.
    const Parts = asSheet ? Drawer : BaseDialog;
    const Keyboard = asSheet ? Drawer.VirtualKeyboardProvider : Fragment;
    const Content = asSheet ? Drawer.Content : "div";

    return (
        <Parts.Root
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            disablePointerDismissal={!dismissible}
        >
            <Keyboard>
                {trigger && <Parts.Trigger render={trigger} />}
                <Parts.Portal>
                    <Parts.Backdrop className={styles.backdrop} />
                    <Parts.Viewport
                        className={cx(styles.viewport, asSheet && styles.sheetViewport)}
                    >
                        <Parts.Popup
                            className={cx(
                                styles.popup,
                                asSheet ? styles.sheet : styles.panel,
                                styles[size],
                                className,
                            )}
                            initialFocus={initialFocus}
                        >
                            {asSheet && <span className={styles.handle} aria-hidden="true" />}
                            <Content className={styles.content}>
                                <header className={styles.header}>
                                    <div className={styles.heading}>
                                        <Parts.Title className={styles.title}>{title}</Parts.Title>
                                        {description && (
                                            <Parts.Description className={styles.description}>
                                                {description}
                                            </Parts.Description>
                                        )}
                                    </div>
                                </header>
                                {children && <div className={styles.body}>{children}</div>}
                                {footer && <footer className={styles.footer}>{footer}</footer>}
                                {/* Last in the markup, so focus starts on the first field and Tab reaches this at the end */}
                                <Parts.Close
                                    render={
                                        <IconButton
                                            icon="close"
                                            label="Close"
                                            size="sm"
                                            className={styles.close}
                                        />
                                    }
                                />
                            </Content>
                        </Parts.Popup>
                    </Parts.Viewport>
                </Parts.Portal>
            </Keyboard>
        </Parts.Root>
    );
};

// A button in the footer that closes the dialog: <Dialog.Close render={<Button>Cancel</Button>} />
Dialog.Close = BaseDialog.Close;

export default Dialog;
