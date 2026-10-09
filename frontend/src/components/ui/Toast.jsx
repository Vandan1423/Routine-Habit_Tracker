import { Toast as BaseToast } from "@base-ui/react/toast";
import Button from "./Button";
import Icon from "./Icon";
import IconButton from "./IconButton";
import { toastManager } from "../../lib/toast";
import styles from "./Toast.module.css";

// Draws what `toast()` (lib/toast.js) queues. Quiet text, at most one action, no coloured stripes.
const Toasts = () => {
    const { toasts } = BaseToast.useToastManager();

    return toasts.map((item) => {
        const isError = item.type === "error";

        return (
            <BaseToast.Root
                key={item.id}
                toast={item}
                className={styles.toast}
                swipeDirection={["down", "left", "right"]}
            >
                <BaseToast.Content className={styles.content}>
                    {isError && <Icon name="alert" className={styles.alert} />}
                    {/* A short detail ("+20 XP") stands beside the message; a longer one takes the lines under it */}
                    <div className={styles.text}>
                        <BaseToast.Title className={styles.message} render={<p />} />
                        {item.description && (
                            <BaseToast.Description className={styles.detail} render={<span />} />
                        )}
                    </div>
                    {item.actionProps && (
                        <BaseToast.Action
                            className={styles.action}
                            render={<Button variant="ghost" size="sm" />}
                        />
                    )}
                    {/* An error stays longer, so it can also be put away by hand */}
                    {isError && (
                        <BaseToast.Close
                            className={styles.close}
                            render={<IconButton icon="close" label="Dismiss" size="sm" />}
                        />
                    )}
                </BaseToast.Content>
            </BaseToast.Root>
        );
    });
};

/**
 * Wraps the app once and gives toasts their place on screen. To show one, call `toast()` from lib/toast.js.
 * At most three show at a time; older ones wait their turn.
 */
export const ToastProvider = ({ children }) => (
    <BaseToast.Provider toastManager={toastManager} limit={3}>
        {children}
        <BaseToast.Portal>
            <BaseToast.Viewport className={styles.viewport}>
                <Toasts />
            </BaseToast.Viewport>
        </BaseToast.Portal>
    </BaseToast.Provider>
);
