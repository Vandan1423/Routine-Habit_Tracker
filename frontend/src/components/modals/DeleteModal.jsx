// src/components/DeleteModal.jsx
// Confirmation modal for deleting a routine.

import { useEffect } from "react";
import styles from "./DeleteModal.module.css";

export default function DeleteModal({
    isOpen,
    onClose,
    onConfirm,
    routineTitle,
    loading,
}) {
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className={styles.modal} role="alertdialog" aria-modal="true">
                {/* Warning Icon */}
                <div className={styles.iconWrap}>
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                </div>

                <h2 className={styles.title}>Delete Routine?</h2>
                <p className={styles.description}>
                    Are you sure you want to delete{" "}
                    <strong>&ldquo;{routineTitle}&rdquo;</strong>? This action
                    cannot be undone.
                </p>

                <div className={styles.actions}>
                    <button
                        className={styles.cancelBtn}
                        onClick={onClose}
                        disabled={loading}
                    >
                        Keep It
                    </button>
                    <button
                        className={styles.deleteBtn}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className={styles.btnSpinner} />
                        ) : (
                            <>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                </svg>
                                Yes, Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
