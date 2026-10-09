import { Toast } from "@base-ui/react/toast";

// One queue of toasts for the whole app, so anything can add to it: a component, a context,
// a request that failed. <ToastProvider> (components/ui/Toast.jsx) draws them.
export const toastManager = Toast.createToastManager();

// How long each kind stays, in milliseconds. Hovering or focusing a toast pauses the clock.
const STAY = {
    plain: 5000,
    withAction: 8000, // long enough to notice a mistake and reach Undo
    error: 10000,
};

/**
 * Shows a short message at the bottom of the screen and returns its id.
 *   toast("Deep work done", { detail: "+20 XP", action: { label: "Undo", onClick: undo } })
 *   toast.error("That didn’t save. Check your connection.", { action: { label: "Try again", onClick: save } })
 *   toast.dismiss(id)
 *
 * message: one plain sentence, or less
 * detail: a quieter addition, such as the XP earned
 * action: { label, onClick }. One at most. Choosing it closes the toast.
 * duration: milliseconds before it goes; 0 keeps it until dismissed
 * id: showing a toast with the id of one already on screen replaces that one
 */
const show = (message, { detail, action, tone, duration, id } = {}) => {
    const toastId = toastManager.add({
        id,
        title: message,
        description: detail,
        type: tone,
        // An error interrupts a screen reader; anything else waits its turn
        priority: tone === "error" ? "high" : "low",
        timeout: duration ?? (tone === "error" ? STAY.error : action ? STAY.withAction : STAY.plain),
        actionProps: action && {
            children: action.label,
            onClick: () => {
                action.onClick?.();
                toastManager.close(toastId);
            },
        },
    });

    return toastId;
};

export const toast = Object.assign(show, {
    error: (message, options) => show(message, { ...options, tone: "error" }),
    dismiss: (id) => toastManager.close(id),
});
