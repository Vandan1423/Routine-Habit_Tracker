import styles from "./ToastMessage.module.css";

export default function ToastMessage({ message, type = "error", onClose }) {
    if (!message) return null;

    return (
        <div className={`${styles.toast} ${styles[type] || ""}`} role="status" aria-live="polite">
            <div className={styles.icon}>{type === "error" ? "!" : "i"}</div>
            <div className={styles.content}>{message}</div>
            <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    );
}