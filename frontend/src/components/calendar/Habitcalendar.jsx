// src/components/HabitCalendar/HabitCalendar.jsx
// Weekly strip + monthly calendar grid showing habit completion history.
// Receives: habit object (with habit.logs array), onClose callback

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./Habitcalendar.module.css";

const CATEGORY_META = {
    health: { color: "#10b981" },
    fitness: { color: "#ef4444" },
    learning: { color: "#f59e0b" },
    personal: { color: "#8b5cf6" },
    work: { color: "#3b82f6" },
    other: { color: "#6b7280" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

// Build a Set of "YYYY-MM-DD" strings where the habit was completed
function buildCompletedSet(logs = []) {
    const s = new Set();
    logs.forEach((log) => {
        if (log.completed || log.quantity > 0) {
            s.add(log.date?.substring(0, 10) || "");
        }
    });
    return s;
}

function pad(n) {
    return String(n).padStart(2, "0");
}
function toKey(y, m, d) {
    return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayKey() {
    const n = new Date();
    return toKey(n.getFullYear(), n.getMonth(), n.getDate());
}

// ── Weekly strip: last 7 days ──────────────────────────────
function WeeklyStrip({ completedSet, color }) {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
        const isToday = i === 0;
        const done = completedSet.has(key);
        days.push({
            key,
            label: DAY_LABELS[d.getDay()],
            date: d.getDate(),
            isToday,
            done,
        });
    }

    return (
        <div className={styles.weekStrip}>
            {days.map((day) => (
                <div
                    key={day.key}
                    className={`${styles.weekDay} ${day.isToday ? styles.weekDayToday : ""}`}
                >
                    <span className={styles.weekDayLabel}>{day.label}</span>
                    <div
                        className={`${styles.weekDot} ${day.done ? styles.weekDotDone : styles.weekDotEmpty}`}
                        style={
                            day.done
                                ? {
                                      background: color,
                                      boxShadow: `0 0 8px ${color}55`,
                                  }
                                : {}
                        }
                    >
                        {day.done && (
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#fff"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                    </div>
                    <span className={styles.weekDayNum}>{day.date}</span>
                </div>
            ))}
        </div>
    );
}

// ── Monthly calendar grid ──────────────────────────────────
function MonthGrid({ completedSet, color, year, month }) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayKey();

    const cells = [];
    // Leading empty cells
    for (let i = 0; i < firstDay; i++) cells.push(null);
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const key = toKey(year, month, d);
        const isFuture = key > today;
        const isToday = key === today;
        const done = completedSet.has(key);
        cells.push({ d, key, isFuture, isToday, done });
    }

    return (
        <div className={styles.monthGrid}>
            {DAY_LABELS.map((l) => (
                <div key={l} className={styles.monthDayHeader}>
                    {l}
                </div>
            ))}
            {cells.map((cell, idx) =>
                cell === null ? (
                    <div key={`empty-${idx}`} className={styles.monthCell} />
                ) : (
                    <div
                        key={cell.key}
                        className={[
                            styles.monthCell,
                            styles.monthCellDay,
                            cell.done ? styles.monthCellDone : "",
                            cell.isToday ? styles.monthCellToday : "",
                            cell.isFuture ? styles.monthCellFuture : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        style={
                            cell.done
                                ? {
                                      background: color + "22",
                                      borderColor: color + "66",
                                  }
                                : {}
                        }
                        title={
                            cell.done
                                ? "Completed"
                                : cell.isFuture
                                  ? "Future"
                                  : "Missed"
                        }
                    >
                        <span
                            className={styles.monthCellNum}
                            style={cell.done ? { color } : {}}
                        >
                            {cell.d}
                        </span>
                        {cell.done && (
                            <div
                                className={styles.monthDot}
                                style={{ background: color }}
                            />
                        )}
                    </div>
                ),
            )}
        </div>
    );
}

// ── Main HabitCalendar ─────────────────────────────────────
export default function HabitCalendar({ habit, onClose }) {
    const [view, setView] = useState("weekly"); // "weekly" | "monthly"
    const today = new Date();
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());

    const completedSet = buildCompletedSet(habit.logs || []);
    const color = CATEGORY_META[habit.category]?.color || "#1a7a4a";

    const totalCompleted = completedSet.size;
    const streak = habit.currentStreak || 0;
    const bestStreak = habit.bestStreak || streak;

    // Escape key + body scroll lock
    useEffect(() => {
        const h = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", h);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", h);
            document.body.style.overflow = "";
        };
    }, [onClose]);

    const prevMonth = () => {
        if (calMonth === 0) {
            setCalMonth(11);
            setCalYear((y) => y - 1);
        } else setCalMonth((m) => m - 1);
    };
    const nextMonth = () => {
        const now = new Date();
        if (
            calYear > now.getFullYear() ||
            (calYear === now.getFullYear() && calMonth >= now.getMonth())
        )
            return;
        if (calMonth === 11) {
            setCalMonth(0);
            setCalYear((y) => y + 1);
        } else setCalMonth((m) => m + 1);
    };

    return createPortal(
        <div
            className={styles.overlay}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className={styles.modal} role="dialog" aria-modal="true">
                {/* Modal header */}
                <div className={styles.panelHeader}>
                    <div className={styles.panelTitle}>
                        <span className={styles.panelEmoji}>{habit.title}</span>
                        <span className={styles.panelSub}>
                            Completion History
                        </span>
                    </div>
                    <button className={styles.panelClose} onClick={onClose}>
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
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Stats row */}
                <div className={styles.statsRow}>
                    <div className={styles.statItem}>
                        <span className={styles.statNum} style={{ color }}>
                            🔥 {streak}
                        </span>
                        <span className={styles.statLbl}>Current Streak</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNum} style={{ color }}>
                            ⚡ {bestStreak}
                        </span>
                        <span className={styles.statLbl}>Best Streak</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNum} style={{ color }}>
                            ✅ {totalCompleted}
                        </span>
                        <span className={styles.statLbl}>Total Done</span>
                    </div>
                </div>

                {/* View toggle */}
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.viewBtn} ${view === "weekly" ? styles.viewBtnActive : ""}`}
                        onClick={() => setView("weekly")}
                        style={
                            view === "weekly"
                                ? { borderColor: color, color }
                                : {}
                        }
                    >
                        This Week
                    </button>
                    <button
                        className={`${styles.viewBtn} ${view === "monthly" ? styles.viewBtnActive : ""}`}
                        onClick={() => setView("monthly")}
                        style={
                            view === "monthly"
                                ? { borderColor: color, color }
                                : {}
                        }
                    >
                        Monthly
                    </button>
                </div>

                {view === "weekly" ? (
                    <WeeklyStrip completedSet={completedSet} color={color} />
                ) : (
                    <div className={styles.monthSection}>
                        <div className={styles.monthNav}>
                            <button
                                className={styles.monthNavBtn}
                                onClick={prevMonth}
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
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <span className={styles.monthName}>
                                {MONTH_NAMES[calMonth]} {calYear}
                            </span>
                            <button
                                className={styles.monthNavBtn}
                                onClick={nextMonth}
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
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                        <MonthGrid
                            completedSet={completedSet}
                            color={color}
                            year={calYear}
                            month={calMonth}
                        />
                        <div className={styles.legend}>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendDot}
                                    style={{ background: color }}
                                />{" "}
                                Completed
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendDot}
                                    style={{ background: "var(--bg-muted)" }}
                                />{" "}
                                Missed
                            </span>
                            <span className={styles.legendItem}>
                                <span
                                    className={styles.legendDot}
                                    style={{
                                        background: "var(--border-subtle)",
                                        border: "1px dashed var(--border-medium)",
                                    }}
                                />{" "}
                                Future
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        (() => {
            let el = document.getElementById("portal-root");
            if (!el) {
                el = document.createElement("div");
                el.id = "portal-root";
                document.body.appendChild(el);
            }
            return el;
        })(),
    );
}
