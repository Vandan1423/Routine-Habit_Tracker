// src/pages/DashboardPage/DashboardPage.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";
import streakService from "../../services/streakService";
import gamificationService from "../../services/gamificationService";
import styles from "./DashboardPage.module.css";

// ─── Helpers ─────────────────────────────────────────────────
const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
};

const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};

const CATEGORY_COLORS = {
    health: "#10b981",
    work: "#3b82f6",
    personal: "#8b5cf6",
    learning: "#f59e0b",
    fitness: "#ef4444",
    other: "#6b7280",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Mini Sparkline ──────────────────────────────────────────
function Sparkline({ data = [], color = "#1a7a4a", height = 36 }) {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const w = 120;
    const pts = data
        .map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = height - (v / max) * (height - 6) - 3;
            return `${x},${y}`;
        })
        .join(" ");
    const area = `0,${height} ${pts} ${w},${height}`;
    return (
        <svg
            width={w}
            height={height}
            viewBox={`0 0 ${w} ${height}`}
            className={styles.sparkline}
        >
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={area} fill="url(#sparkGrad)" />
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// ─── XP Bar ──────────────────────────────────────────────────
function XPBar({ current, max, level }) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    return (
        <div className={styles.xpBarWrap}>
            <div className={styles.xpBarTrack}>
                <div
                    className={styles.xpBarFill}
                    style={{ width: `${pct}%` }}
                />
                <div className={styles.xpBarGlow} style={{ left: `${pct}%` }} />
            </div>
            <div className={styles.xpBarLabels}>
                <span>{current} XP</span>
                <span>
                    {max} XP to Level {level + 1}
                </span>
            </div>
        </div>
    );
}

// ─── Activity Ring ───────────────────────────────────────────
function ActivityRing({ done, total, size = 72 }) {
    const pct = total > 0 ? done / total : 0;
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const dash = pct * circ;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(26,122,74,0.1)"
                strokeWidth="8"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="8"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                    transition:
                        "stroke-dasharray 800ms cubic-bezier(0.4,0,0.2,1)",
                }}
            />
            <text
                x={size / 2}
                y={size / 2 - 4}
                textAnchor="middle"
                fontSize="14"
                fontWeight="800"
                fill="var(--brand-primary)"
            >
                {done}
            </text>
            <text
                x={size / 2}
                y={size / 2 + 11}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="var(--text-muted)"
            >
                of {total}
            </text>
        </svg>
    );
}

// ─── Weekly Heatmap ──────────────────────────────────────────
function WeekHeatmap({ logs = [] }) {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const log = logs.find((l) => l.date?.startsWith(key));
        days.push({
            key,
            label: DAYS_SHORT[d.getDay()],
            date: d.getDate(),
            isToday: i === 0,
            log,
        });
    }
    return (
        <div className={styles.heatmapRow}>
            {days.map((day) => {
                const score = day.log ? day.log.completionRate || 0 : 0;
                const opacity = day.log ? Math.max(0.2, score) : 0;
                return (
                    <div
                        key={day.key}
                        className={`${styles.heatDay} ${day.isToday ? styles.heatDayToday : ""}`}
                    >
                        <div className={styles.heatDayLabel}>{day.label}</div>
                        <div
                            className={styles.heatDot}
                            style={{
                                background: day.log
                                    ? `rgba(26,122,74,${opacity})`
                                    : "var(--bg-muted)",
                                border: day.isToday
                                    ? "2px solid var(--brand-primary)"
                                    : "1px solid var(--border-subtle)",
                            }}
                            title={
                                day.log
                                    ? `${Math.round(score * 100)}% completion`
                                    : "No data"
                            }
                        />
                        <div className={styles.heatDayNum}>{day.date}</div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Dashboard ──────────────────────────────────────────
export default function DashboardPage() {
    const { user, levelInfo } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        routines: [],
        habits: [],
        streakInfo: { currentStreak: 0, bestStreak: 0 },
        dailyLogs: [],
        xpHistory: [],
        gamStats: null,
    });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const dateStr = getLocalDateStr();
                const [
                    routinesRes,
                    habitsRes,
                    streakInfo,
                    logsRes,
                    xpRes,
                    gamRes,
                ] = await Promise.all([
                    api.get(`/routines?date=${dateStr}`),
                    api.get("/habits"),
                    streakService.getInfo(),
                    api.get("/streaks/logs"),
                    gamificationService.getXPHistory(),
                    gamificationService.getStats(),
                ]);
                setData({
                    routines: routinesRes.data.routines || [],
                    habits: habitsRes.data.habits || [],
                    streakInfo: streakInfo || {
                        currentStreak: 0,
                        bestStreak: 0,
                    },
                    dailyLogs: logsRes.data?.logs || logsRes.data || [],
                    xpHistory: xpRes?.history || xpRes || [],
                    gamStats: gamRes,
                });
            } catch (err) {
                console.error("Dashboard load error:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Derived Stats ──
    const { routines, habits, streakInfo, dailyLogs, xpHistory } = data;

    const totalTasks = routines.length;
    const doneTasks = routines.filter((r) => r.todayLog).length;
    const totalHabits = habits.length;
    const doneHabits = habits.filter((h) => h.todayLog?.completed).length;
    const taskPct =
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const habitPct =
        totalHabits > 0 ? Math.round((doneHabits / totalHabits) * 100) : 0;

    // XP sparkline — last 7 days
    const xpSparkData = (() => {
        if (!xpHistory.length) return [0, 0, 0, 0, 0, 0, 0];
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const entry = xpHistory.find((x) => x.date?.startsWith(key));
            return entry?.xp || entry?.amount || 0;
        });
    })();

    // Overall daily score
    const totalItems = totalTasks + totalHabits;
    const doneItems = doneTasks + doneHabits;
    const overallPct =
        totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    const motivationalMsg =
        overallPct === 100
            ? "🎉 Perfect day! You crushed everything!"
            : overallPct >= 75
              ? "🔥 Almost there, keep pushing!"
              : overallPct >= 50
                ? "💪 Great momentum, stay focused!"
                : overallPct >= 25
                  ? "⚡ You've started strong, keep going!"
                  : "🌅 Fresh day ahead — let's make it count!";

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className={styles.loadingDot} />
                <div
                    className={styles.loadingDot}
                    style={{ animationDelay: "150ms" }}
                />
                <div
                    className={styles.loadingDot}
                    style={{ animationDelay: "300ms" }}
                />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* ── Hero Section ── */}
            <section className={styles.hero}>
                <div className={styles.heroLeft}>
                    <p className={styles.greeting}>{getGreeting()},</p>
                    <h1 className={styles.userName}>
                        {user?.name?.split(" ")[0] || "Explorer"} 👋
                    </h1>
                    <p className={styles.motivational}>{motivationalMsg}</p>

                    {/* XP Progress Bar */}
                    <XPBar
                        current={levelInfo.currentXp}
                        max={levelInfo.xpForNext}
                        level={levelInfo.level}
                    />
                </div>

                <div className={styles.heroRight}>
                    {/* Level Badge */}
                    <div className={styles.levelBadge}>
                        <div className={styles.levelDiamond}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </div>
                        <span className={styles.levelNum}>
                            Level {levelInfo.level}
                        </span>
                        <span className={styles.levelXp}>
                            {levelInfo.totalXp} total XP
                        </span>
                    </div>

                    {/* Overall Progress Ring */}
                    <div className={styles.overallRing}>
                        <ActivityRing
                            done={doneItems}
                            total={totalItems}
                            size={88}
                        />
                        <span className={styles.overallLabel}>Today</span>
                    </div>
                </div>
            </section>

            {/* ── Stat Cards Row ── */}
            <div className={styles.statsGrid}>
                <div
                    className={styles.statCard}
                    onClick={() => navigate("/routine")}
                    style={{ cursor: "pointer" }}
                >
                    <div className={styles.statCardTop}>
                        <div
                            className={styles.statIcon}
                            style={{
                                background: "rgba(26,122,74,0.1)",
                                color: "var(--brand-primary)",
                            }}
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
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <span
                            className={styles.statTrend}
                            style={{
                                color:
                                    taskPct === 100
                                        ? "var(--brand-primary)"
                                        : "var(--text-muted)",
                            }}
                        >
                            {taskPct}%
                        </span>
                    </div>
                    <div className={styles.statValue}>
                        {doneTasks}
                        <span className={styles.statOf}>/{totalTasks}</span>
                    </div>
                    <div className={styles.statLabel}>Tasks Done</div>
                    <div className={styles.statBar}>
                        <div
                            className={styles.statBarFill}
                            style={{
                                width: `${taskPct}%`,
                                background: "var(--brand-primary)",
                            }}
                        />
                    </div>
                </div>

                <div
                    className={styles.statCard}
                    onClick={() => navigate("/habits")}
                    style={{ cursor: "pointer" }}
                >
                    <div className={styles.statCardTop}>
                        <div
                            className={styles.statIcon}
                            style={{
                                background: "rgba(139,92,246,0.1)",
                                color: "#8b5cf6",
                            }}
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
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <span
                            className={styles.statTrend}
                            style={{
                                color:
                                    habitPct === 100
                                        ? "#8b5cf6"
                                        : "var(--text-muted)",
                            }}
                        >
                            {habitPct}%
                        </span>
                    </div>
                    <div
                        className={styles.statValue}
                        style={{ color: "#8b5cf6" }}
                    >
                        {doneHabits}
                        <span className={styles.statOf}>/{totalHabits}</span>
                    </div>
                    <div className={styles.statLabel}>Habits Done</div>
                    <div className={styles.statBar}>
                        <div
                            className={styles.statBarFill}
                            style={{
                                width: `${habitPct}%`,
                                background: "#8b5cf6",
                            }}
                        />
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statCardTop}>
                        <div
                            className={styles.statIcon}
                            style={{
                                background: "rgba(245,158,11,0.1)",
                                color: "#f59e0b",
                            }}
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
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                        <Sparkline
                            data={xpSparkData}
                            color="#f59e0b"
                            height={28}
                        />
                    </div>
                    <div
                        className={styles.statValue}
                        style={{ color: "#f59e0b" }}
                    >
                        {levelInfo.currentXp}
                        <span className={styles.statUnit}> XP</span>
                    </div>
                    <div className={styles.statLabel}>This Level</div>
                    <div className={styles.statBar}>
                        <div
                            className={styles.statBarFill}
                            style={{
                                width: `${Math.min((levelInfo.currentXp / levelInfo.xpForNext) * 100, 100)}%`,
                                background: "#f59e0b",
                            }}
                        />
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statCardTop}>
                        <div
                            className={styles.statIcon}
                            style={{
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                            }}
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
                                <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z" />
                            </svg>
                        </div>
                        <span
                            className={styles.statTrend}
                            style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                            }}
                        >
                            Best: {streakInfo.bestStreak}d
                        </span>
                    </div>
                    <div
                        className={styles.statValue}
                        style={{ color: "#ef4444" }}
                    >
                        {streakInfo.currentStreak}
                        <span className={styles.statUnit}> days</span>
                    </div>
                    <div className={styles.statLabel}>Current Streak 🔥</div>
                    <div className={styles.statBar}>
                        <div
                            className={styles.statBarFill}
                            style={{
                                width: `${Math.min((streakInfo.currentStreak / Math.max(streakInfo.bestStreak, 1)) * 100, 100)}%`,
                                background: "#ef4444",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Two Column Content ── */}
            <div className={styles.contentGrid}>
                {/* LEFT COLUMN */}
                <div className={styles.leftCol}>
                    {/* Today's Schedule */}
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitleGroup}>
                                <div
                                    className={styles.widgetDot}
                                    style={{
                                        background: "var(--brand-primary)",
                                    }}
                                />
                                <h2 className={styles.widgetTitle}>
                                    Today's Schedule
                                </h2>
                            </div>
                            <button
                                className={styles.widgetLink}
                                onClick={() => navigate("/routine")}
                            >
                                View all →
                            </button>
                        </div>

                        {routines.length === 0 ? (
                            <div className={styles.emptyWidget}>
                                <span>📋</span>
                                <p>No routines scheduled for today</p>
                                <button
                                    className={styles.emptyBtn}
                                    onClick={() => navigate("/routine")}
                                >
                                    Add Routine
                                </button>
                            </div>
                        ) : (
                            <div className={styles.scheduleList}>
                                {routines
                                    .sort((a, b) =>
                                        (a.startTime || "").localeCompare(
                                            b.startTime || "",
                                        ),
                                    )
                                    .slice(0, 5)
                                    .map((r) => {
                                        const isDone = !!r.todayLog;
                                        const catColor =
                                            CATEGORY_COLORS[r.category] ||
                                            "#6b7280";
                                        return (
                                            <div
                                                key={r._id}
                                                className={`${styles.scheduleItem} ${isDone ? styles.scheduleItemDone : ""}`}
                                            >
                                                <div
                                                    className={
                                                        styles.scheduleTime
                                                    }
                                                >
                                                    <span>
                                                        {formatTime(
                                                            r.startTime,
                                                        )}
                                                    </span>
                                                    {r.endTime && (
                                                        <span
                                                            className={
                                                                styles.scheduleTimeEnd
                                                            }
                                                        >
                                                            {formatTime(
                                                                r.endTime,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className={
                                                        styles.scheduleLine
                                                    }
                                                    style={{
                                                        background: isDone
                                                            ? "var(--brand-primary)"
                                                            : catColor,
                                                    }}
                                                />
                                                <div
                                                    className={
                                                        styles.scheduleContent
                                                    }
                                                >
                                                    <span
                                                        className={`${styles.scheduleTitle} ${isDone ? styles.scheduleTitleDone : ""}`}
                                                    >
                                                        {r.title}
                                                    </span>
                                                    <span
                                                        className={
                                                            styles.scheduleCat
                                                        }
                                                        style={{
                                                            color: catColor,
                                                        }}
                                                    >
                                                        {r.category}
                                                    </span>
                                                </div>
                                                <div
                                                    className={
                                                        styles.scheduleStatus
                                                    }
                                                >
                                                    {isDone ? (
                                                        <div
                                                            className={
                                                                styles.doneCheck
                                                            }
                                                        >
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
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={
                                                                styles.pendingDot
                                                            }
                                                            style={{
                                                                background:
                                                                    catColor,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                {routines.length > 5 && (
                                    <button
                                        className={styles.showMoreBtn}
                                        onClick={() => navigate("/routine")}
                                    >
                                        +{routines.length - 5} more tasks
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Weekly Activity Heatmap */}
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitleGroup}>
                                <div
                                    className={styles.widgetDot}
                                    style={{ background: "#f59e0b" }}
                                />
                                <h2 className={styles.widgetTitle}>
                                    Weekly Activity
                                </h2>
                            </div>
                        </div>
                        <WeekHeatmap logs={dailyLogs} />
                        <div className={styles.heatmapLegend}>
                            <span>Less active</span>
                            <div className={styles.heatmapLegendDots}>
                                {[0.1, 0.3, 0.5, 0.75, 1].map((o, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: 3,
                                            background: `rgba(26,122,74,${o})`,
                                        }}
                                    />
                                ))}
                            </div>
                            <span>More active</span>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className={styles.rightCol}>
                    {/* Habits Today */}
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitleGroup}>
                                <div
                                    className={styles.widgetDot}
                                    style={{ background: "#8b5cf6" }}
                                />
                                <h2 className={styles.widgetTitle}>
                                    Habits Today
                                </h2>
                            </div>
                            <button
                                className={styles.widgetLink}
                                onClick={() => navigate("/habits")}
                            >
                                View all →
                            </button>
                        </div>

                        {habits.length === 0 ? (
                            <div className={styles.emptyWidget}>
                                <span>🌱</span>
                                <p>No habits built yet</p>
                                <button
                                    className={styles.emptyBtn}
                                    onClick={() => navigate("/habits")}
                                >
                                    Build a Habit
                                </button>
                            </div>
                        ) : (
                            <div className={styles.habitsList}>
                                {habits.slice(0, 5).map((h) => {
                                    const isDone = h.todayLog?.completed;
                                    const isQty = h.habitType === "quantity";
                                    const pct = isQty
                                        ? Math.min(
                                              ((h.todayLog?.quantity || 0) /
                                                  (h.targetQuantity || 1)) *
                                                  100,
                                              100,
                                          )
                                        : isDone
                                          ? 100
                                          : 0;
                                    const catColor =
                                        CATEGORY_COLORS[h.category] ||
                                        "#6b7280";
                                    return (
                                        <div
                                            key={h._id}
                                            className={`${styles.habitItem} ${isDone ? styles.habitItemDone : ""}`}
                                        >
                                            <div
                                                className={styles.habitItemLeft}
                                            >
                                                <div
                                                    className={
                                                        styles.habitColorBar
                                                    }
                                                    style={{
                                                        background: catColor,
                                                    }}
                                                />
                                                <div
                                                    className={
                                                        styles.habitItemInfo
                                                    }
                                                >
                                                    <span
                                                        className={`${styles.habitItemTitle} ${isDone ? styles.habitItemTitleDone : ""}`}
                                                    >
                                                        {h.title}
                                                    </span>
                                                    {isQty && (
                                                        <span
                                                            className={
                                                                styles.habitItemProgress
                                                            }
                                                        >
                                                            {h.todayLog
                                                                ?.quantity || 0}
                                                            /{h.targetQuantity}{" "}
                                                            {h.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div
                                                className={
                                                    styles.habitItemRight
                                                }
                                            >
                                                {isDone ? (
                                                    <div
                                                        className={
                                                            styles.habitDoneChip
                                                        }
                                                    >
                                                        ✓ Done
                                                    </div>
                                                ) : isQty ? (
                                                    <div
                                                        className={
                                                            styles.habitQtyPct
                                                        }
                                                    >
                                                        {Math.round(pct)}%
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={
                                                            styles.habitPendingChip
                                                        }
                                                    >
                                                        Pending
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {habits.length > 5 && (
                                    <button
                                        className={styles.showMoreBtn}
                                        onClick={() => navigate("/habits")}
                                    >
                                        +{habits.length - 5} more habits
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Streak + Coins Widget */}
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitleGroup}>
                                <div
                                    className={styles.widgetDot}
                                    style={{ background: "#ef4444" }}
                                />
                                <h2 className={styles.widgetTitle}>
                                    Streak & Rewards
                                </h2>
                            </div>
                        </div>
                        <div className={styles.rewardsGrid}>
                            <div
                                className={styles.rewardCard}
                                style={{ "--reward-color": "#ef4444" }}
                            >
                                <div className={styles.rewardIcon}>🔥</div>
                                <div className={styles.rewardValue}>
                                    {streakInfo.currentStreak}
                                </div>
                                <div className={styles.rewardLabel}>
                                    Day Streak
                                </div>
                            </div>
                            <div
                                className={styles.rewardCard}
                                style={{ "--reward-color": "#f59e0b" }}
                            >
                                <div className={styles.rewardIcon}>⚡</div>
                                <div className={styles.rewardValue}>
                                    {levelInfo.totalXp}
                                </div>
                                <div className={styles.rewardLabel}>
                                    Total XP
                                </div>
                            </div>
                            <div
                                className={styles.rewardCard}
                                style={{ "--reward-color": "#c8921a" }}
                            >
                                <div className={styles.rewardIcon}>🪙</div>
                                <div className={styles.rewardValue}>
                                    {levelInfo.coins}
                                </div>
                                <div className={styles.rewardLabel}>Coins</div>
                            </div>
                            <div
                                className={styles.rewardCard}
                                style={{ "--reward-color": "#3b82f6" }}
                            >
                                <div className={styles.rewardIcon}>🏆</div>
                                <div className={styles.rewardValue}>
                                    {streakInfo.bestStreak}
                                </div>
                                <div className={styles.rewardLabel}>
                                    Best Streak
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className={styles.widget}>
                        <div className={styles.widgetHeader}>
                            <div className={styles.widgetTitleGroup}>
                                <div
                                    className={styles.widgetDot}
                                    style={{ background: "#3b82f6" }}
                                />
                                <h2 className={styles.widgetTitle}>
                                    Quick Actions
                                </h2>
                            </div>
                        </div>
                        <div className={styles.quickActions}>
                            <button
                                className={styles.quickAction}
                                onClick={() => navigate("/routine")}
                            >
                                <div
                                    className={styles.qaIcon}
                                    style={{
                                        background: "rgba(26,122,74,0.1)",
                                        color: "var(--brand-primary)",
                                    }}
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
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <span>My Routine</span>
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        marginLeft: "auto",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                            <button
                                className={styles.quickAction}
                                onClick={() => navigate("/habits")}
                            >
                                <div
                                    className={styles.qaIcon}
                                    style={{
                                        background: "rgba(139,92,246,0.1)",
                                        color: "#8b5cf6",
                                    }}
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
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <span>My Habits</span>
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        marginLeft: "auto",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                            <button
                                className={styles.quickAction}
                                onClick={() => navigate("/progress")}
                            >
                                <div
                                    className={styles.qaIcon}
                                    style={{
                                        background: "rgba(245,158,11,0.1)",
                                        color: "#f59e0b",
                                    }}
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
                                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                                        <polyline points="16 7 22 7 22 13" />
                                    </svg>
                                </div>
                                <span>My Progress</span>
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        marginLeft: "auto",
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
