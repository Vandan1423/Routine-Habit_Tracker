// src/pages/HabitsPage/HabitsPage.jsx
// Premium rewrite — card grid, modals, calendar tracker, filters, confetti.

import { useState, useRef, useCallback } from "react";
import useHabit from "../../hooks/useHabit";
import useAuth from "../../hooks/useAuth";
import HabitModal from "../../components/modals/HabitModal";
import DeleteModal from "../../components/modals//DeleteModal";
import HabitCalendar from "../../components/calendar/Habitcalendar";
import ConfettiEffect from "../../components/Effects/ConfettiEffect";
import styles from "./HabitsPage.module.css";

// ─── Constants ───────────────────────────────────────────────
const CATEGORY_META = {
    health: { label: "Health", emoji: "🏥", color: "#10b981" },
    fitness: { label: "Fitness", emoji: "💪", color: "#ef4444" },
    learning: { label: "Learning", emoji: "📚", color: "#f59e0b" },
    personal: { label: "Personal", emoji: "🌱", color: "#8b5cf6" },
    work: { label: "Work", emoji: "💼", color: "#3b82f6" },
    other: { label: "Other", emoji: "✨", color: "#6b7280" },
};

const DIFF_META = {
    easy: { label: "Easy", color: "#10b981", bg: "#d1fae5" },
    medium: { label: "Medium", color: "#f59e0b", bg: "#fef3c7" },
    hard: { label: "Hard", color: "#ef4444", bg: "#fee2e2" },
};

const FILTERS = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "done", label: "Done Today" },
    { key: "streaking", label: "On Streak 🔥" },
];

// ─── Progress Ring SVG ───────────────────────────────────────
function ProgressRing({ pct, color, size = 52 }) {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <svg width={size} height={size} className={styles.ring}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="var(--bg-muted)"
                strokeWidth="5"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="5"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                    transition:
                        "stroke-dasharray 600ms cubic-bezier(0.4,0,0.2,1)",
                }}
            />
            <text
                x={size / 2}
                y={size / 2 + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={color}
            >
                {Math.round(pct)}%
            </text>
        </svg>
    );
}

// ─── Habit Card ──────────────────────────────────────────────
function HabitCard({ habit, onEdit, onDelete, onLog, onViewCalendar, idx }) {
    const [quickLogging, setQuickLogging] = useState(false);
    const [customAmount, setCustomAmount] = useState(1);
    const [note, setNote] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const logBtnRef = useRef(null);

    const meta = CATEGORY_META[habit.category] || CATEGORY_META.other;
    const diff = DIFF_META[habit.difficulty] || DIFF_META.medium;
    const isDone = habit.todayLog?.completed || false;
    const currentQty = habit.todayLog?.quantity || 0;
    const isQty = habit.habitType === "quantity";
    const pct = isQty
        ? Math.min((currentQty / (habit.targetQuantity || 1)) * 100, 100)
        : isDone
          ? 100
          : 0;

    const handleQuickLog = async (e) => {
        if (quickLogging) return;
        setQuickLogging(true);
        await onLog(habit._id, { quantity: 1 }, e);
        setQuickLogging(false);
        setShowCustom(false);
    };

    const handleCustomLog = async () => {
        if (quickLogging) return;
        setQuickLogging(true);
        await onLog(
            habit._id,
            { quantity: customAmount, note },
            logBtnRef.current,
        );
        setQuickLogging(false);
        setShowCustom(false);
        setNote("");
        setCustomAmount(1);
    };

    const handleBoolLog = async (e) => {
        if (quickLogging) return;
        setQuickLogging(true);
        await onLog(habit._id, { quantity: 1 }, e?.currentTarget);
        setQuickLogging(false);
    };

    return (
        <div
            className={`${styles.card} ${isDone ? styles.cardDone : ""}`}
            style={{
                animationDelay: `${idx * 60}ms`,
                "--cat-color": meta.color,
            }}
        >
            {/* Top color bar */}
            <div
                className={styles.cardBar}
                style={{ background: meta.color }}
            />

            {/* Card Header */}
            <div className={styles.cardHeader}>
                <div className={styles.cardHeaderLeft}>
                    <span className={styles.categoryEmoji}>{meta.emoji}</span>
                    <div>
                        <span
                            className={styles.categoryLabel}
                            style={{ color: meta.color }}
                        >
                            {meta.label}
                        </span>
                        <div
                            className={styles.diffBadge}
                            style={{ color: diff.color, background: diff.bg }}
                        >
                            {diff.label}
                        </div>
                    </div>
                </div>
                <div className={styles.cardActions}>
                    <button
                        className={styles.calendarBtn}
                        onClick={() => onViewCalendar(habit)}
                        title="View history"
                    >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect
                                x="3"
                                y="4"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                            />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </button>
                    <button
                        className={styles.editBtn}
                        onClick={() => onEdit(habit)}
                        title="Edit"
                    >
                        <svg
                            width="13"
                            height="13"
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
                    </button>
                    <button
                        className={styles.deleteBtn}
                        onClick={() => onDelete(habit)}
                        title="Delete"
                    >
                        <svg
                            width="13"
                            height="13"
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
                    </button>
                </div>
            </div>

            {/* Title + Progress Ring */}
            <div className={styles.cardBody}>
                <div className={styles.titleRow}>
                    <h3
                        className={`${styles.habitTitle} ${isDone ? styles.habitTitleDone : ""}`}
                    >
                        {habit.title}
                    </h3>
                    {isQty && <ProgressRing pct={pct} color={meta.color} />}
                </div>
                {habit.description && (
                    <p className={styles.habitDesc}>{habit.description}</p>
                )}

                {/* Quantity bar */}
                {isQty && (
                    <div className={styles.qtySection}>
                        <div className={styles.qtyText}>
                            <span
                                style={{ color: meta.color, fontWeight: 700 }}
                            >
                                {currentQty}
                            </span>
                            <span className={styles.qtyOf}>
                                {" "}
                                / {habit.targetQuantity} {habit.unit}
                            </span>
                        </div>
                        <div className={styles.qtyTrack}>
                            <div
                                className={styles.qtyFill}
                                style={{
                                    width: `${pct}%`,
                                    background: meta.color,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Stats row */}
                <div className={styles.statsRow}>
                    <span className={styles.streak}>
                        🔥 <strong>{habit.currentStreak || 0}</strong> day
                        streak
                    </span>
                    <span className={styles.xpBadge}>
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        +{habit.xpReward} XP
                    </span>
                    {habit.frequency === "weekly" &&
                        habit.targetDays?.length > 0 && (
                            <span className={styles.freqBadge}>
                                {["S", "M", "T", "W", "T", "F", "S"]
                                    .filter((_, i) =>
                                        habit.targetDays.includes(i),
                                    )
                                    .join(" · ")}
                            </span>
                        )}
                </div>
            </div>

            {/* Card Footer — Log actions */}
            <div className={styles.cardFooter}>
                {/* Boolean habit — done state, no more logging */}
                {!isQty && isDone ? (
                    <div className={styles.completedBadge}>
                        <svg
                            width="13"
                            height="13"
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
                        Completed Today!
                    </div>
                ) : showCustom ? (
                    <div className={styles.customPanel}>
                        {isQty && (
                            <div className={styles.customRow}>
                                <span className={styles.customLabel}>Add:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={customAmount}
                                    onChange={(e) =>
                                        setCustomAmount(Number(e.target.value))
                                    }
                                    className={styles.customInput}
                                />
                                <span className={styles.customUnit}>
                                    {habit.unit}
                                </span>
                            </div>
                        )}
                        <input
                            type="text"
                            placeholder="Add a note (optional)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={styles.customNote}
                        />
                        <div className={styles.customActions}>
                            <button
                                className={styles.customCancel}
                                onClick={() => setShowCustom(false)}
                            >
                                Cancel
                            </button>
                            <button
                                ref={logBtnRef}
                                className={styles.customConfirm}
                                onClick={handleCustomLog}
                                disabled={quickLogging}
                                style={{ background: meta.color }}
                            >
                                {quickLogging
                                    ? "…"
                                    : isQty
                                      ? `Add ${customAmount}`
                                      : "Done ✓"}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Quantity habit: always show log buttons (even after completion for bonus XP) */
                    <div className={styles.logGroup}>
                        {isDone && isQty && (
                            <span className={styles.bonusXpHint}>
                                +bonus XP
                            </span>
                        )}
                        {isQty && (
                            <button
                                className={styles.quickBtn}
                                style={{ "--btn-color": meta.color }}
                                onClick={handleQuickLog}
                                disabled={quickLogging}
                            >
                                {quickLogging ? "…" : "+1"}
                            </button>
                        )}
                        <button
                            className={styles.logBtn}
                            style={{ "--btn-color": meta.color }}
                            onClick={
                                isQty
                                    ? () => setShowCustom(true)
                                    : handleBoolLog
                            }
                            disabled={quickLogging}
                        >
                            {isQty ? (
                                "Add More"
                            ) : (
                                <>
                                    <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Mark Done
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────
export default function HabitsPage() {
    const { habits, loading, createHabit, updateHabit, deleteHabit, logHabit } =
        useHabit();
    const { fetchGamificationStats } = useAuth();

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingHabit, setEditingHabit] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Calendar panel
    const [calendarHabit, setCalendarHabit] = useState(null); // which habit's calendar is open

    // Filters
    const [activeFilter, setActiveFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");

    // Confetti
    const [confetti, setConfetti] = useState(null);
    const loggingRef = useRef(new Set());

    // ── Stats ──
    const doneToday = habits.filter((h) => h.todayLog?.completed).length;
    const totalStreaking = habits.filter(
        (h) => (h.currentStreak || 0) > 0,
    ).length;
    const totalXpToday = habits
        .filter((h) => h.todayLog?.completed)
        .reduce((sum, h) => sum + (h.xpReward || 0), 0);

    // ── Filtering ──
    const categories = ["all", ...new Set(habits.map((h) => h.category))];

    const filtered = habits.filter((h) => {
        const catMatch =
            categoryFilter === "all" || h.category === categoryFilter;
        const filterMatch =
            activeFilter === "all"
                ? true
                : activeFilter === "done"
                  ? h.todayLog?.completed
                  : activeFilter === "pending"
                    ? !h.todayLog?.completed
                    : activeFilter === "streaking"
                      ? (h.currentStreak || 0) > 0
                      : true;
        return catMatch && filterMatch;
    });

    // ── Log handler ──
    const handleLog = useCallback(
        async (id, data, targetEl) => {
            if (loggingRef.current.has(id)) return;
            loggingRef.current.add(id);

            const result = await logHabit(id, data);
            if (result.success) {
                // Get position for confetti
                const rect = targetEl?.getBoundingClientRect?.();
                const cx = rect
                    ? rect.left + rect.width / 2
                    : window.innerWidth / 2;
                const cy = rect
                    ? rect.top + rect.height / 2
                    : window.innerHeight / 2;
                if (result.data?.todayLog?.completed) {
                    setConfetti({ x: cx, y: cy });
                }
                await fetchGamificationStats();
            }

            loggingRef.current.delete(id);
            return result.success;
        },
        [logHabit, fetchGamificationStats],
    );

    // ── Modal handlers ──
    const openAdd = () => {
        setEditingHabit(null);
        setModalOpen(true);
    };
    const openEdit = (habit) => {
        setEditingHabit(habit);
        setModalOpen(true);
    };
    const closeModal = () => {
        setModalOpen(false);
        setEditingHabit(null);
    };

    const handleModalSubmit = async (formData) => {
        setFormLoading(true);
        const result = editingHabit
            ? await updateHabit(editingHabit._id, formData)
            : await createHabit(formData);
        setFormLoading(false);
        if (result.success) closeModal();
        return result;
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        await deleteHabit(deleteTarget.id);
        setDeleteLoading(false);
        setDeleteTarget(null);
    };

    return (
        <div className={styles.page}>
            {confetti && (
                <ConfettiEffect
                    x={confetti.x}
                    y={confetti.y}
                    onDone={() => setConfetti(null)}
                />
            )}

            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>My Habits</h1>
                    <p className={styles.pageSubtitle}>
                        Build consistency, one day at a time.
                    </p>
                </div>
                <button className={styles.addBtn} onClick={openAdd}>
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
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Habit
                </button>
            </div>

            {/* ── Stats Bar ── */}
            {!loading && habits.length > 0 && (
                <div className={styles.statsBar}>
                    <div className={styles.statCard}>
                        <span className={styles.statNum}>{habits.length}</span>
                        <span className={styles.statLabel}>Total Habits</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statCard}>
                        <span
                            className={styles.statNum}
                            style={{ color: "#1a7a4a" }}
                        >
                            {doneToday}
                        </span>
                        <span className={styles.statLabel}>Done Today</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statCard}>
                        <span
                            className={styles.statNum}
                            style={{ color: "#f59e0b" }}
                        >
                            🔥 {totalStreaking}
                        </span>
                        <span className={styles.statLabel}>On Streak</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statCard}>
                        <span
                            className={styles.statNum}
                            style={{ color: "#1a7a4a" }}
                        >
                            ⚡ {totalXpToday}
                        </span>
                        <span className={styles.statLabel}>
                            XP Earned Today
                        </span>
                    </div>
                </div>
            )}

            {/* ── Filters ── */}
            <div className={styles.controlsRow}>
                <div className={styles.filterGroup}>
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            className={`${styles.filterBtn} ${activeFilter === f.key ? styles.filterBtnActive : ""}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label}
                            {f.key === "done" && doneToday > 0 && (
                                <span
                                    className={`${styles.filterCount} ${styles.filterCountGreen}`}
                                >
                                    {doneToday}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Category filter pills */}
                <div className={styles.catFilter}>
                    {categories.map((c) => {
                        const m = CATEGORY_META[c];
                        return (
                            <button
                                key={c}
                                className={`${styles.catBtn} ${categoryFilter === c ? styles.catBtnActive : ""}`}
                                style={
                                    categoryFilter === c && m
                                        ? {
                                              borderColor: m.color,
                                              color: m.color,
                                              background: m.color + "12",
                                          }
                                        : {}
                                }
                                onClick={() => setCategoryFilter(c)}
                            >
                                {m ? m.emoji + " " + m.label : "All"}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className={styles.skeletonGrid}>
                    {[1, 2, 3, 4].map((n) => (
                        <div
                            key={n}
                            className={styles.skeletonCard}
                            style={{ animationDelay: `${n * 80}ms` }}
                        />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                        {activeFilter === "done" ? "🎉" : "🌱"}
                    </div>
                    <h3 className={styles.emptyTitle}>
                        {habits.length === 0
                            ? "No habits yet"
                            : activeFilter === "done"
                              ? "None completed today"
                              : activeFilter === "pending"
                                ? "All done today! 🎉"
                                : "No habits match this filter"}
                    </h3>
                    <p className={styles.emptyDesc}>
                        {habits.length === 0
                            ? "Start building your daily practices."
                            : "Try a different filter or add a new habit."}
                    </p>
                    {habits.length === 0 && (
                        <button
                            className={styles.emptyAddBtn}
                            onClick={openAdd}
                        >
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
                            </svg>
                            Add First Habit
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtered.map((habit, idx) => (
                        <HabitCard
                            key={habit._id}
                            habit={habit}
                            idx={idx}
                            onEdit={openEdit}
                            onDelete={(h) =>
                                setDeleteTarget({ id: h._id, title: h.title })
                            }
                            onLog={handleLog}
                            onViewCalendar={(h) => setCalendarHabit(h)}
                        />
                    ))}
                </div>
            )}

            {/* ── Modals ── */}
            {calendarHabit && (
                <HabitCalendar
                    habit={calendarHabit}
                    onClose={() => setCalendarHabit(null)}
                />
            )}
            <HabitModal
                isOpen={modalOpen}
                onClose={closeModal}
                onSubmit={handleModalSubmit}
                editingHabit={editingHabit}
                loading={formLoading}
            />
            <DeleteModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                routineTitle={deleteTarget?.title || ""}
                loading={deleteLoading}
            />
        </div>
    );
}
