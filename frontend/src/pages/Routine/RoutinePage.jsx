// src/pages/RoutinePage.jsx
// Premium rewrite — timeline layout, modals, confetti, filters.

import { useState, useCallback, useRef, useEffect } from "react";
import useRoutine from "../../hooks/useRoutine";
import useAuth from "../../hooks/useAuth";
import RoutineModal from "../../components/modals/RoutineModal";
import DeleteModal from "../../components/modals/DeleteModal";
import ConfettiEffect from "../../components/Effects/ConfettiEffect";
import styles from "./RoutinePage.module.css";

// ─── Constants ───────────────────────────────────────────────
const CATEGORY_META = {
    health: { label: "Health", emoji: "🏥", color: "#10b981" },
    work: { label: "Work", emoji: "💼", color: "#3b82f6" },
    personal: { label: "Personal", emoji: "🌱", color: "#8b5cf6" },
    learning: { label: "Learning", emoji: "📚", color: "#f59e0b" },
    fitness: { label: "Fitness", emoji: "💪", color: "#ef4444" },
    other: { label: "Other", emoji: "✨", color: "#6b7280" },
};

const FILTERS = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "done", label: "Done" },
];

// ─── Helpers ─────────────────────────────────────────────────
const getLocalYYYYMMDD = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const formatTime = (t) => {
    if (!t) return "";

    const normalized = String(t).trim();
    if (/\b[AP]M$/i.test(normalized)) {
        return normalized.replace(/\s+/g, " ").toUpperCase();
    }

    const [h, m] = normalized.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${m} ${ampm}`;
};

const timeToMinutes = (timeStr) => {
    if (!timeStr) return null;

    const normalized = String(timeStr).trim();
    const ampmMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);

    if (ampmMatch) {
        let hour = Number(ampmMatch[1]);
        const minutes = Number(ampmMatch[2]);
        const meridiem = ampmMatch[3].toUpperCase();

        if (meridiem === "PM" && hour !== 12) hour += 12;
        if (meridiem === "AM" && hour === 12) hour = 0;

        return hour * 60 + minutes;
    }

    const [hourPart, minutePart] = normalized.split(":");
    return Number(hourPart) * 60 + Number(minutePart);
};

const isToday = (dateObj) => {
    const now = new Date();
    return (
        dateObj.getDate() === now.getDate() &&
        dateObj.getMonth() === now.getMonth() &&
        dateObj.getFullYear() === now.getFullYear()
    );
};

// Returns true if the current wall-clock time falls inside the task's time window.
// For tasks with no endTime, treats a 30-minute window after startTime as active.
const isCurrentlyActive = (routine, nowMinutes) => {
    if (!routine.startTime) return false;
    const [sh, sm] = routine.startTime.split(":").map(Number);
    const startMins = sh * 60 + sm;

    let endMins;
    if (routine.endTime) {
        const [eh, em] = routine.endTime.split(":").map(Number);
        endMins = eh * 60 + em;
    } else {
        endMins = startMins + 30; // default 30-min window
    }

    return nowMinutes >= startMins && nowMinutes <= endMins;
};

// ─── Component ───────────────────────────────────────────────
export default function RoutinePage() {
    const {
        routines,
        loading,
        selectedDate,
        setSelectedDate,
        createRoutine,
        updateRoutine,
        deleteRoutine,
        completeRoutine,
        uncompleteRoutine,
    } = useRoutine();

    const { fetchGamificationStats } = useAuth();

    // ── Modal state ──
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
    const [formLoading, setFormLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // ── Filter & sort ──
    const [activeFilter, setActiveFilter] = useState("all");
    const [sortBy, setSortBy] = useState("time"); // "time" | "category"

    // ── Confetti ──
    const [confetti, setConfetti] = useState(null); // { x, y }

    // ── Current time in minutes (updates every 30s for active-task highlighting) ──
    const getNowMinutes = () => {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
    };
    const [nowMinutes, setNowMinutes] = useState(getNowMinutes);

    useEffect(() => {
        const tick = setInterval(() => setNowMinutes(getNowMinutes()), 30_000);
        return () => clearInterval(tick);
    }, []);

    // ── Completion tracking (to prevent double-fire) ──
    const completingRef = useRef(new Set());

    // ── Date helpers ──
    const changeDate = (delta) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        setSelectedDate(d);
    };

    const goToToday = () => setSelectedDate(new Date());

    const formattedDate = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    const todayFlag = isToday(selectedDate);

    // ── Completion toggle handler ──
    const handleCheckboxToggle = useCallback(
        async (routine, e) => {
            const id = routine._id;
            if (completingRef.current.has(id)) return;
            completingRef.current.add(id);

            const isDone = !!routine.todayLog;

            if (isDone) {
                // Uncheck — remove completion
                const dateStr = getLocalYYYYMMDD(selectedDate);
                await uncompleteRoutine(id, dateStr);
                await fetchGamificationStats();
            } else {
                // Check — mark complete with confetti
                const rect = e?.currentTarget?.getBoundingClientRect();
                const cx = rect
                    ? rect.left + rect.width / 2
                    : window.innerWidth / 2;
                const cy = rect
                    ? rect.top + rect.height / 2
                    : window.innerHeight / 2;

                const dateStr = getLocalYYYYMMDD(selectedDate);
                const result = await completeRoutine(id, dateStr);
                if (result.success) {
                    setConfetti({ x: cx, y: cy });
                    await fetchGamificationStats();
                }
            }

            completingRef.current.delete(id);
        },
        [
            selectedDate,
            completeRoutine,
            uncompleteRoutine,
            fetchGamificationStats,
        ],
    );

    // ── Add / Edit modal ──
    const openAddModal = () => {
        setEditingRoutine(null);
        setModalOpen(true);
    };

    const openEditModal = (routine) => {
        setEditingRoutine(routine);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingRoutine(null);
    };

    const handleModalSubmit = async (formData) => {
        setFormLoading(true);
        let result;
        if (editingRoutine) {
            result = await updateRoutine(editingRoutine._id, formData);
        } else {
            result = await createRoutine(formData);
        }
        setFormLoading(false);
        if (result.success) closeModal();
        return result;
    };

    // ── Delete modal ──
    const openDeleteModal = (routine) => {
        setDeleteTarget({ id: routine._id, title: routine.title });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        await deleteRoutine(deleteTarget.id);
        setDeleteLoading(false);
        setDeleteTarget(null);
    };

    // ── Filtering & sorting ──
    const filteredRoutines = routines
        .filter((r) => {
            if (activeFilter === "done") return !!r.todayLog;
            if (activeFilter === "pending") return !r.todayLog;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === "time") {
                return (a.startTime || "").localeCompare(b.startTime || "");
            }
            return (a.category || "").localeCompare(b.category || "");
        });

    const doneCount = routines.filter((r) => !!r.todayLog).length;
    const totalCount = routines.length;
    const progressPct =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    // ─────────────────────────────────────────────────────────
    return (
        <div className={styles.page}>
            {/* ── Confetti Layer ── */}
            {confetti && (
                <ConfettiEffect
                    x={confetti.x}
                    y={confetti.y}
                    onDone={() => setConfetti(null)}
                />
            )}

            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLeft}>
                    <h1 className={styles.pageTitle}>My Routine</h1>
                    <p className={styles.pageSubtitle}>
                        {todayFlag
                            ? "Here's your plan for today."
                            : "Viewing a past or future day."}
                    </p>
                </div>

                <button className={styles.addBtn} onClick={openAddModal}>
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
                    Add Routine
                </button>
            </div>

            {/* ── Date Navigator ── */}
            <div className={styles.dateStrip}>
                <button
                    className={styles.dateNavBtn}
                    onClick={() => changeDate(-1)}
                    aria-label="Previous day"
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
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div className={styles.dateCenter}>
                    <span className={styles.dateLabel}>{formattedDate}</span>
                    {!todayFlag && (
                        <button
                            className={styles.todayPill}
                            onClick={goToToday}
                        >
                            Back to Today
                        </button>
                    )}
                    {todayFlag && (
                        <span className={styles.todayBadge}>Today</span>
                    )}
                </div>

                <button
                    className={styles.dateNavBtn}
                    onClick={() => changeDate(1)}
                    aria-label="Next day"
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
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* ── Progress Bar ── */}
            {totalCount > 0 && (
                <div className={styles.progressSection}>
                    <div className={styles.progressHeader}>
                        <span className={styles.progressText}>
                            {doneCount} of {totalCount} tasks completed
                        </span>
                        <span className={styles.progressPct}>
                            {progressPct}%
                        </span>
                    </div>
                    <div className={styles.progressTrack}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Filters & Sort ── */}
            <div className={styles.controlsRow}>
                <div className={styles.filterGroup}>
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            className={`${styles.filterBtn} ${activeFilter === f.key ? styles.filterBtnActive : ""}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label}
                            {f.key === "all" && totalCount > 0 && (
                                <span className={styles.filterCount}>
                                    {totalCount}
                                </span>
                            )}
                            {f.key === "done" && doneCount > 0 && (
                                <span
                                    className={`${styles.filterCount} ${styles.filterCountGreen}`}
                                >
                                    {doneCount}
                                </span>
                            )}
                            {f.key === "pending" &&
                                totalCount - doneCount > 0 && (
                                    <span className={styles.filterCount}>
                                        {totalCount - doneCount}
                                    </span>
                                )}
                        </button>
                    ))}
                </div>

                <div className={styles.sortGroup}>
                    <span className={styles.sortLabel}>Sort:</span>
                    <button
                        className={`${styles.sortBtn} ${sortBy === "time" ? styles.sortBtnActive : ""}`}
                        onClick={() => setSortBy("time")}
                    >
                        Time
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortBy === "category" ? styles.sortBtnActive : ""}`}
                        onClick={() => setSortBy("category")}
                    >
                        Category
                    </button>
                </div>
            </div>

            {/* ── Routine List ── */}
            <div className={styles.listArea}>
                {loading ? (
                    <div className={styles.skeletonList}>
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className={styles.skeletonCard}
                                style={{ animationDelay: `${n * 80}ms` }}
                            />
                        ))}
                    </div>
                ) : filteredRoutines.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            {activeFilter === "done"
                                ? "🎉"
                                : activeFilter === "pending"
                                  ? "✅"
                                  : "📋"}
                        </div>
                        <h3 className={styles.emptyTitle}>
                            {activeFilter === "done"
                                ? "No completed tasks yet"
                                : activeFilter === "pending"
                                  ? "All tasks done! Great work."
                                  : "No routines scheduled"}
                        </h3>
                        <p className={styles.emptyDesc}>
                            {activeFilter === "all"
                                ? "Add your first routine to start building your day."
                                : "Adjust the filter or add more tasks."}
                        </p>
                        {activeFilter === "all" && (
                            <button
                                className={styles.emptyAddBtn}
                                onClick={openAddModal}
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
                                Add First Routine
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={styles.timelineList}>
                        {filteredRoutines.map((routine, idx) => {
                            const meta =
                                CATEGORY_META[routine.category] ||
                                CATEGORY_META.other;
                            const isDone = !!routine.todayLog;
                            const completedMinutes = isDone
                                ? timeToMinutes(routine.todayLog.completedAt)
                                : null;
                            const startMinutes = timeToMinutes(
                                routine.startTime,
                            );
                            const wasEarly =
                                isDone &&
                                completedMinutes !== null &&
                                startMinutes !== null &&
                                completedMinutes < startMinutes;
                            const wasLate =
                                isDone &&
                                !wasEarly &&
                                !routine.todayLog.wasOnTime;
                            // Only highlight active tasks on today's view, and only if not already done
                            const isActive =
                                todayFlag &&
                                !isDone &&
                                isCurrentlyActive(routine, nowMinutes);

                            return (
                                <div
                                    key={routine._id}
                                    className={[
                                        styles.card,
                                        isDone ? styles.cardDone : "",
                                        wasLate ? styles.cardLate : "",
                                        isActive ? styles.cardActive : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    style={{ animationDelay: `${idx * 55}ms` }}
                                >
                                    {/* Left: Checkbox + Time Stem */}
                                    <div className={styles.cardLeft}>
                                        <div className={styles.timeLabel}>
                                            {formatTime(routine.startTime)}
                                        </div>
                                        <div className={styles.stem} />
                                        {routine.endTime && (
                                            <div
                                                className={`${styles.timeLabel} ${styles.timeLabelEnd}`}
                                            >
                                                {formatTime(routine.endTime)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Checkbox */}
                                    <div
                                        className={styles.checkboxWrap}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    >
                                        <label
                                            className={`${styles.checkboxLabel} ${isDone ? styles.checkboxDone : ""}`}
                                            aria-label={
                                                isDone
                                                    ? "Mark incomplete"
                                                    : "Mark complete"
                                            }
                                            title={
                                                isDone
                                                    ? "Click to uncheck"
                                                    : "Click to complete"
                                            }
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isDone}
                                                className={styles.checkboxInput}
                                                onChange={() => {}}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCheckboxToggle(
                                                        routine,
                                                        e,
                                                    );
                                                }}
                                            />
                                            <span
                                                className={`${styles.customCheckbox} ${isDone ? styles.customCheckboxDone : ""}`}
                                            >
                                                {isDone && (
                                                    <svg
                                                        width="11"
                                                        height="11"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="3"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </span>
                                        </label>
                                    </div>

                                    {/* Card Body */}
                                    <div
                                        className={`${styles.cardBody} ${styles.cardBodyClickable}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openEditModal(routine)}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                e.preventDefault();
                                                openEditModal(routine);
                                            }
                                        }}
                                    >
                                        <div className={styles.cardTopRow}>
                                            <h3
                                                className={`${styles.cardTitle} ${isDone ? styles.cardTitleDone : ""}`}
                                            >
                                                {routine.title}
                                                {isActive && (
                                                    <span
                                                        className={
                                                            styles.nowBadge
                                                        }
                                                    >
                                                        ● NOW
                                                    </span>
                                                )}
                                            </h3>
                                            <div
                                                className={
                                                    styles.cardTopActions
                                                }
                                            >
                                                {/* Category Chip */}
                                                <span
                                                    className={
                                                        styles.categoryChip
                                                    }
                                                    style={{
                                                        "--cat-color":
                                                            meta.color,
                                                        "--cat-bg": `${meta.color}18`,
                                                    }}
                                                >
                                                    {meta.emoji} {meta.label}
                                                </span>

                                                {/* Recurring badge */}
                                                {routine.isRecurring && (
                                                    <span
                                                        className={
                                                            styles.recurringBadge
                                                        }
                                                        title="Recurring"
                                                    >
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
                                                            <polyline points="23 4 23 10 17 10" />
                                                            <polyline points="1 20 1 14 7 14" />
                                                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                                        </svg>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {routine.description && (
                                            <p className={styles.cardDesc}>
                                                {routine.description}
                                            </p>
                                        )}

                                        {/* Completion info or action row */}
                                        <div className={styles.cardFooter}>
                                            {isDone ? (
                                                <div
                                                    className={`${styles.completionBadge} ${wasLate ? styles.completionLate : styles.completionOnTime}`}
                                                >
                                                    {wasLate ? (
                                                        <>
                                                            <svg
                                                                width="12"
                                                                height="12"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <circle
                                                                    cx="12"
                                                                    cy="12"
                                                                    r="10"
                                                                />
                                                                <polyline points="12 6 12 12 16 14" />
                                                            </svg>
                                                            Completed late at{" "}
                                                            {formatTime(
                                                                routine.todayLog
                                                                    .completedAt,
                                                            )}
                                                        </>
                                                    ) : wasEarly ? (
                                                        <>
                                                            <svg
                                                                width="12"
                                                                height="12"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M12 2v4" />
                                                                <path d="M12 18v4" />
                                                                <path d="M4.93 4.93l2.83 2.83" />
                                                                <path d="M16.24 16.24l2.83 2.83" />
                                                                <path d="M2 12h4" />
                                                                <path d="M18 12h4" />
                                                                <path d="M4.93 19.07l2.83-2.83" />
                                                                <path d="M16.24 7.76l2.83-2.83" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                            Completed early at{" "}
                                                            {formatTime(
                                                                routine.todayLog
                                                                    .completedAt,
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg
                                                                width="12"
                                                                height="12"
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
                                                            Done on time at{" "}
                                                            {formatTime(
                                                                routine.todayLog
                                                                    .completedAt,
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <span
                                                    className={
                                                        styles.pendingLabel
                                                    }
                                                >
                                                    Pending
                                                </span>
                                            )}

                                            {/* Action buttons */}
                                            <div className={styles.actionBtns}>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDeleteModal(routine);
                                                    }}
                                                    aria-label="Delete routine"
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
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <RoutineModal
                isOpen={modalOpen}
                onClose={closeModal}
                onSubmit={handleModalSubmit}
                editingRoutine={editingRoutine}
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
