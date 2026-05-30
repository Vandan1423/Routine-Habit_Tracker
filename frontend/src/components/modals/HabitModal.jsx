// src/components/modals/HabitModal.jsx

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./HabitModal.module.css";

const CATEGORIES = [
    { value: "health", label: "Health", emoji: "🏥" },
    { value: "fitness", label: "Fitness", emoji: "💪" },
    { value: "learning", label: "Learning", emoji: "📚" },
    { value: "personal", label: "Personal", emoji: "🌱" },
    { value: "work", label: "Work", emoji: "💼" },
    { value: "other", label: "Other", emoji: "✨" },
];

const DIFFICULTIES = [
    { value: "easy", label: "Easy", xp: "10 XP", color: "#10b981" },
    { value: "medium", label: "Medium", xp: "25 XP", color: "#f59e0b" },
    { value: "hard", label: "Hard", xp: "50 XP", color: "#ef4444" },
];

const DAYS = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

const EMPTY = {
    title: "",
    description: "",
    category: "personal",
    difficulty: "medium",
    habitType: "boolean",
    targetQuantity: 1,
    unit: "",
    frequency: "daily",
    targetDays: [],
};

export default function HabitModal({
    isOpen,
    onClose,
    onSubmit,
    editingHabit,
    loading,
}) {
    // 1. Initialize state cleanly
    const [form, setForm] = useState(() => {
        if (editingHabit) {
            return {
                title: editingHabit.title || "",
                description: editingHabit.description || "",
                category: editingHabit.category || "personal",
                difficulty: editingHabit.difficulty || "medium",
                habitType: editingHabit.habitType || "boolean",
                targetQuantity: editingHabit.targetQuantity || 1,
                unit: editingHabit.unit || "",
                frequency: editingHabit.frequency || "daily",
                targetDays: editingHabit.targetDays || [],
            };
        }
        return EMPTY;
    });

    const [error, setError] = useState("");
    const firstRef = useRef(null);

    // 2. Track previous props to detect changes for the render-phase update
    const [prevHabit, setPrevHabit] = useState(editingHabit);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // 3. Update state during render (replaces the old syncing useEffect)
    if (editingHabit !== prevHabit || isOpen !== prevIsOpen) {
        setPrevHabit(editingHabit);
        setPrevIsOpen(isOpen);

        if (editingHabit) {
            setForm({
                title: editingHabit.title || "",
                description: editingHabit.description || "",
                category: editingHabit.category || "personal",
                difficulty: editingHabit.difficulty || "medium",
                habitType: editingHabit.habitType || "boolean",
                targetQuantity: editingHabit.targetQuantity || 1,
                unit: editingHabit.unit || "",
                frequency: editingHabit.frequency || "daily",
                targetDays: editingHabit.targetDays || [],
            });
        } else {
            setForm(EMPTY);
        }
        setError("");
    }

    useEffect(() => {
        if (isOpen) setTimeout(() => firstRef.current?.focus(), 120);
    }, [isOpen]);

    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

    const toggleDay = (v) =>
        setForm((p) => ({
            ...p,
            targetDays: p.targetDays.includes(v)
                ? p.targetDays.filter((d) => d !== v)
                : [...p.targetDays, v].sort(),
        }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.title.trim()) {
            setError("Title is required.");
            return;
        }
        if (form.frequency === "weekly" && form.targetDays.length === 0) {
            setError("Select at least one day for weekly habits.");
            return;
        }
        const result = await onSubmit(form);
        if (result?.success === false)
            setError(result.message || "Failed to save.");
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className={styles.overlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className={styles.modal} role="dialog" aria-modal="true">
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon}>
                            {editingHabit ? (
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
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h2 className={styles.title}>
                                {editingHabit ? "Edit Habit" : "New Habit"}
                            </h2>
                            <p className={styles.subtitle}>
                                {editingHabit
                                    ? "Update your habit details"
                                    : "Build a new daily practice"}
                            </p>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
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

                <form
                    onSubmit={handleSubmit}
                    className={styles.form}
                    noValidate
                >
                    <div className={styles.body}>
                        {/* Title */}
                        <div className={styles.group}>
                            <label className={styles.label}>
                                Title <span className={styles.req}>*</span>
                            </label>
                            <input
                                ref={firstRef}
                                type="text"
                                value={form.title}
                                onChange={(e) => set("title", e.target.value)}
                                placeholder="e.g. Read 10 pages"
                                className={styles.input}
                                maxLength={80}
                            />
                        </div>

                        {/* Description */}
                        <div className={styles.group}>
                            <label className={styles.label}>
                                Description{" "}
                                <span className={styles.opt}>(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={(e) =>
                                    set("description", e.target.value)
                                }
                                placeholder="Why are you building this habit?"
                                className={styles.input}
                            />
                        </div>

                        {/* Category */}
                        <div className={styles.group}>
                            <label className={styles.label}>Category</label>
                            <div className={styles.chipGrid}>
                                {CATEGORIES.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        className={`${styles.chip} ${form.category === c.value ? styles.chipActive : ""}`}
                                        onClick={() => set("category", c.value)}
                                    >
                                        <span>{c.emoji}</span> {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className={styles.group}>
                            <label className={styles.label}>Difficulty</label>
                            <div className={styles.diffRow}>
                                {DIFFICULTIES.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        className={`${styles.diffBtn} ${form.difficulty === d.value ? styles.diffBtnActive : ""}`}
                                        style={{ "--diff-color": d.color }}
                                        onClick={() =>
                                            set("difficulty", d.value)
                                        }
                                    >
                                        <span className={styles.diffLabel}>
                                            {d.label}
                                        </span>
                                        <span className={styles.diffXp}>
                                            {d.xp}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Habit Type */}
                        <div className={styles.group}>
                            <label className={styles.label}>Habit Type</label>
                            <div className={styles.typeRow}>
                                <button
                                    type="button"
                                    className={`${styles.typeBtn} ${form.habitType === "boolean" ? styles.typeBtnActive : ""}`}
                                    onClick={() => set("habitType", "boolean")}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Yes / No
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.typeBtn} ${form.habitType === "quantity" ? styles.typeBtnActive : ""}`}
                                    onClick={() => set("habitType", "quantity")}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="12" y1="20" x2="12" y2="10" />
                                        <line x1="18" y1="20" x2="18" y2="4" />
                                        <line x1="6" y1="20" x2="6" y2="16" />
                                    </svg>
                                    Target Amount
                                </button>
                            </div>
                        </div>

                        {/* Quantity fields */}
                        {form.habitType === "quantity" && (
                            <div className={styles.row}>
                                <div className={styles.group}>
                                    <label className={styles.label}>
                                        Target Quantity
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.targetQuantity}
                                        onChange={(e) =>
                                            set(
                                                "targetQuantity",
                                                Number(e.target.value),
                                            )
                                        }
                                        className={styles.input}
                                    />
                                </div>
                                <div className={styles.group}>
                                    <label className={styles.label}>
                                        Unit{" "}
                                        <span className={styles.opt}>
                                            (e.g. pages, glasses)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.unit}
                                        onChange={(e) =>
                                            set("unit", e.target.value)
                                        }
                                        placeholder="glasses"
                                        className={styles.input}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Frequency */}
                        <div className={styles.toggleRow}>
                            <div>
                                <span className={styles.toggleLabel}>
                                    Weekly Schedule
                                </span>
                                <span className={styles.toggleDesc}>
                                    Repeat on specific days only
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={form.frequency === "weekly"}
                                className={`${styles.toggle} ${form.frequency === "weekly" ? styles.toggleOn : ""}`}
                                onClick={() =>
                                    set(
                                        "frequency",
                                        form.frequency === "weekly"
                                            ? "daily"
                                            : "weekly",
                                    )
                                }
                            >
                                <span className={styles.toggleThumb} />
                            </button>
                        </div>

                        {form.frequency === "weekly" && (
                            <div className={styles.dayPicker}>
                                {DAYS.map((d) => (
                                    <button
                                        key={d.value}
                                        type="button"
                                        className={`${styles.dayBtn} ${form.targetDays.includes(d.value) ? styles.dayBtnActive : ""}`}
                                        onClick={() => toggleDay(d.value)}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        )}

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

                    <div className={styles.footer}>
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
                                <span className={styles.spinner} />
                            ) : editingHabit ? (
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
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>{" "}
                                    Save Changes
                                </>
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
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>{" "}
                                    Add Habit
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.getElementById("portal-root") || document.body,
    );
}
