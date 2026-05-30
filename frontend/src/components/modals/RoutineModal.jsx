// src/components/RoutineModal.jsx
// Premium Add / Edit routine modal.

import { useState, useEffect, useRef } from "react";
import styles from "./RoutineModal.module.css";

const CATEGORIES = [
    { value: "health", label: "Health", emoji: "🏥" },
    { value: "work", label: "Work", emoji: "💼" },
    { value: "personal", label: "Personal", emoji: "🌱" },
    { value: "learning", label: "Learning", emoji: "📚" },
    { value: "fitness", label: "Fitness", emoji: "💪" },
    { value: "other", label: "Other", emoji: "✨" },
];

const DAYS_OF_WEEK = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

const EMPTY_FORM = {
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    category: "personal",
    isRecurring: false,
    recurringDays: [],
};

export default function RoutineModal({
    isOpen,
    onClose,
    onSubmit,
    editingRoutine,
    loading,
}) {
    // 1. Initialize state cleanly on first load
    const [formData, setFormData] = useState(() => {
        if (editingRoutine) {
            return {
                title: editingRoutine.title || "",
                description: editingRoutine.description || "",
                startTime: editingRoutine.startTime || "",
                endTime: editingRoutine.endTime || "",
                category: editingRoutine.category || "personal",
                isRecurring: editingRoutine.isRecurring || false,
                recurringDays: editingRoutine.recurringDays || [],
            };
        }
        return EMPTY_FORM;
    });

    const [error, setError] = useState("");
    const firstInputRef = useRef(null);

    // 2. Track previous props to detect changes for the render-phase update
    const [prevRoutine, setPrevRoutine] = useState(editingRoutine);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // 3. Update state during render (replaces the old syncing useEffect)
    if (editingRoutine !== prevRoutine || isOpen !== prevIsOpen) {
        setPrevRoutine(editingRoutine);
        setPrevIsOpen(isOpen);

        if (editingRoutine) {
            setFormData({
                title: editingRoutine.title || "",
                description: editingRoutine.description || "",
                startTime: editingRoutine.startTime || "",
                endTime: editingRoutine.endTime || "",
                category: editingRoutine.category || "personal",
                isRecurring: editingRoutine.isRecurring || false,
                recurringDays: editingRoutine.recurringDays || [],
            });
        } else {
            setFormData(EMPTY_FORM);
        }
        setError("");
    }

    // Focus first input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => firstInputRef.current?.focus(), 120);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleDayToggle = (dayValue) => {
        setFormData((prev) => {
            const days = prev.recurringDays;
            return {
                ...prev,
                recurringDays: days.includes(dayValue)
                    ? days.filter((d) => d !== dayValue)
                    : [...days, dayValue].sort(),
            };
        });
    };

    const handleCategorySelect = (value) => {
        setFormData((prev) => ({ ...prev, category: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!formData.title.trim()) {
            setError("Title is required.");
            return;
        }
        if (!formData.startTime) {
            setError("Start time is required.");
            return;
        }
        if (formData.isRecurring && formData.recurringDays.length === 0) {
            setError("Select at least one recurring day.");
            return;
        }

        const result = await onSubmit(formData);
        if (result?.success === false) {
            setError(result.message || "Failed to save. Try again.");
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={editingRoutine ? "Edit Routine" : "Add Routine"}
            >
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleGroup}>
                        <div className={styles.modalIcon}>
                            {editingRoutine ? (
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            ) : (
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h2 className={styles.modalTitle}>
                                {editingRoutine
                                    ? "Edit Routine"
                                    : "New Routine"}
                            </h2>
                            <p className={styles.modalSubtitle}>
                                {editingRoutine
                                    ? "Update your scheduled task"
                                    : "Schedule a new task for your day"}
                            </p>
                        </div>
                    </div>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className={styles.form}
                    noValidate
                >
                    <div className={styles.formBody}>
                        {/* Title */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>
                                Task Title{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                ref={firstInputRef}
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. Morning Workout"
                                className={styles.input}
                                maxLength={80}
                            />
                        </div>

                        {/* Description */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>
                                Description{" "}
                                <span className={styles.optional}>
                                    (optional)
                                </span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Add details or notes..."
                                className={styles.textarea}
                                rows={2}
                                maxLength={200}
                            />
                        </div>

                        {/* Time Row */}
                        <div className={styles.row}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>
                                    Start Time{" "}
                                    <span className={styles.required}>*</span>
                                </label>
                                <input
                                    type="time"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleChange}
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>
                                    End Time{" "}
                                    <span className={styles.optional}>
                                        (optional)
                                    </span>
                                </label>
                                <input
                                    type="time"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleChange}
                                    className={styles.input}
                                />
                            </div>
                        </div>

                        {/* Category */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Category</label>
                            <div className={styles.categoryGrid}>
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() =>
                                            handleCategorySelect(cat.value)
                                        }
                                        className={`${styles.categoryChip} ${formData.category === cat.value ? styles.categoryChipActive : ""} ${styles[`cat_${cat.value}`]}`}
                                    >
                                        <span className={styles.catEmoji}>
                                            {cat.emoji}
                                        </span>
                                        <span>{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recurring Toggle */}
                        <div className={styles.toggleRow}>
                            <div className={styles.toggleInfo}>
                                <span className={styles.toggleLabel}>
                                    Recurring Routine
                                </span>
                                <span className={styles.toggleDesc}>
                                    Repeats on selected days every week
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={formData.isRecurring}
                                onClick={() =>
                                    setFormData((p) => ({
                                        ...p,
                                        isRecurring: !p.isRecurring,
                                        recurringDays: [],
                                    }))
                                }
                                className={`${styles.toggle} ${formData.isRecurring ? styles.toggleOn : ""}`}
                            >
                                <span className={styles.toggleThumb} />
                            </button>
                        </div>

                        {/* Day Picker (conditionally shown) */}
                        {formData.isRecurring && (
                            <div className={styles.dayPicker}>
                                {DAYS_OF_WEEK.map((day) => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() =>
                                            handleDayToggle(day.value)
                                        }
                                        className={`${styles.dayBtn} ${formData.recurringDays.includes(day.value) ? styles.dayBtnActive : ""}`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className={styles.errorBox}>
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
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className={styles.modalFooter}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={styles.cancelBtn}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className={styles.btnSpinner} />
                            ) : editingRoutine ? (
                                <>
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Save Changes
                                </>
                            ) : (
                                <>
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add Routine
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
