// src/pages/ProgressPage/ProgressPage.jsx

import { useState, useEffect } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import useAuth from "../../hooks/useAuth";
import progressService from "../../services/progressService";
import styles from "./ProgressPage.module.css";

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });

const REASON_META = {
    routine_complete: { label: "Routine Done", icon: "⏰", color: "#10b981" },
    habit_log: { label: "Habit Logged", icon: "✅", color: "#8b5cf6" },
    habit_complete: { label: "Habit Complete", icon: "🎯", color: "#8b5cf6" },
    streak_bonus: { label: "Streak Bonus", icon: "🔥", color: "#ef4444" },
    level_up: { label: "Level Up!", icon: "⭐", color: "#f59e0b" },
    daily_bonus: { label: "Daily Bonus", icon: "🎁", color: "#3b82f6" },
};

const getReason = (raw = "") => {
    const key = raw.toLowerCase().replace(/ /g, "_");
    return (
        REASON_META[key] || {
            label: raw.replace(/_/g, " "),
            icon: "⚡",
            color: "#1a7a4a",
        }
    );
};

// ─── Custom Tooltip ──────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.tooltip}>
            <div className={styles.tooltipDate}>{label}</div>
            <div className={styles.tooltipValue}>
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
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {payload[0].value} XP
            </div>
        </div>
    );
}

// ─── Level Progress Bar ──────────────────────────────────────
function LevelBar({ current, max, level }) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    return (
        <div className={styles.levelBarWrap}>
            <div className={styles.levelBarHeader}>
                <span className={styles.levelBarLabel}>Level {level}</span>
                <span className={styles.levelBarXp}>
                    {current} / {max} XP
                </span>
                <span className={styles.levelBarNext}>Level {level + 1}</span>
            </div>
            <div className={styles.levelBarTrack}>
                <div
                    className={styles.levelBarFill}
                    style={{ width: `${pct}%` }}
                >
                    <div className={styles.levelBarShimmer} />
                </div>
            </div>
            <div className={styles.levelBarPct}>
                {Math.round(pct)}% to next level
            </div>
        </div>
    );
}

// ─── Heatmap ─────────────────────────────────────────────────
function Heatmap({ logs = [] }) {
    // Build exactly 30 days ending today
    const today = new Date();
    const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (29 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const log = logs.find((l) => l.date?.startsWith(key));
        return { key, d, log };
    });

    // Group into 5 rows of 6 (or 6 rows of 5)
    const weeks = [];
    for (let i = 0; i < days.length; i += 6) weeks.push(days.slice(i, i + 6));

    const getIntensity = (log) => {
        if (!log) return 0;
        if (!log.totalHabits && !log.xpEarned) return 0;
        if (log.totalHabits > 0) {
            const r = log.completedHabits / log.totalHabits;
            if (r === 0) return 0;
            if (r < 0.5) return 1;
            if (r < 1) return 2;
            return 3;
        }
        if (log.xpEarned > 0) return 2;
        return 0;
    };

    const intensityColors = [
        "var(--bg-muted)",
        "rgba(26,122,74,0.25)",
        "rgba(26,122,74,0.55)",
        "rgba(26,122,74,0.9)",
    ];

    return (
        <div className={styles.heatmapWrap}>
            <div className={styles.heatmapGrid}>
                {weeks.map((week, wi) => (
                    <div key={wi} className={styles.heatmapRow}>
                        {week.map(({ key, log }) => {
                            const intensity = getIntensity(log);
                            const isToday = key === days[29].key;
                            return (
                                <div
                                    key={key}
                                    className={`${styles.heatSquare} ${isToday ? styles.heatSquareToday : ""}`}
                                    style={{
                                        background: intensityColors[intensity],
                                    }}
                                    title={
                                        log
                                            ? `${fmt(key)}: ${log.completedHabits ?? "?"}/${log.totalHabits ?? "?"} habits · ${log.xpEarned ?? 0} XP`
                                            : `${fmt(key)}: No data`
                                    }
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className={styles.heatmapLegend}>
                <span>Less</span>
                {intensityColors.map((c, i) => (
                    <div
                        key={i}
                        className={styles.heatLegendDot}
                        style={{ background: c }}
                    />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ProgressPage() {
    const { levelInfo } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        streakInfo: { currentStreak: 0, bestStreak: 0 },
        dailyLogs: [],
        xpHistory: [],
    });
    const [chartRange, setChartRange] = useState(30); // 7 | 14 | 30

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [streakRes, logsRes, historyRes] = await Promise.all([
                    progressService.getStreakInfo(),
                    progressService.getDailyLogs(30),
                    progressService.getXPHistory(),
                ]);
                setData({
                    streakInfo: streakRes || {
                        currentStreak: 0,
                        bestStreak: 0,
                    },
                    dailyLogs: logsRes?.logs || [],
                    xpHistory: historyRes?.history || [],
                });
            } catch (err) {
                console.error("Progress load error:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

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

    const { streakInfo, dailyLogs, xpHistory } = data;

    // Chart data — reversed so oldest is left
    const allChartData = [...dailyLogs].reverse().map((log) => ({
        date: fmt(log.date),
        xp: log.xpEarned || 0,
    }));
    const chartData = allChartData.slice(-chartRange);

    // Totals from xpHistory
    const totalXpFromHistory = xpHistory.reduce(
        (s, i) => s + (i.amount > 0 ? i.amount : 0),
        0,
    );
    const avgDailyXp = dailyLogs.length
        ? Math.round(
              dailyLogs.reduce((s, l) => s + (l.xpEarned || 0), 0) /
                  dailyLogs.length,
          )
        : 0;
    const bestDay = dailyLogs.reduce(
        (best, l) => ((l.xpEarned || 0) > (best.xpEarned || 0) ? l : best),
        {},
    );
    const perfectDays = dailyLogs.filter(
        (l) => l.totalHabits > 0 && l.completedHabits === l.totalHabits,
    ).length;

    return (
        <div className={styles.page}>
            {/* ── Page Title ── */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>My Progress</h1>
                    <p className={styles.pageSubtitle}>
                        Your journey at a glance — consistency builds champions.
                    </p>
                </div>
            </div>

            {/* ── Hero Chart Section ── */}
            <div className={styles.heroChart}>
                {/* Floating stat pills */}
                <div className={styles.heroPills}>
                    <div className={styles.pill}>
                        <span className={styles.pillIcon}>🔥</span>
                        <div>
                            <span className={styles.pillValue}>
                                {streakInfo.currentStreak}
                            </span>
                            <span className={styles.pillLabel}>day streak</span>
                        </div>
                    </div>
                    <div className={styles.pill}>
                        <span className={styles.pillIcon}>⚡</span>
                        <div>
                            <span className={styles.pillValue}>
                                {avgDailyXp}
                            </span>
                            <span className={styles.pillLabel}>
                                avg XP / day
                            </span>
                        </div>
                    </div>
                    <div className={styles.pill}>
                        <span className={styles.pillIcon}>✨</span>
                        <div>
                            <span className={styles.pillValue}>
                                {perfectDays}
                            </span>
                            <span className={styles.pillLabel}>
                                perfect days
                            </span>
                        </div>
                    </div>
                    <div className={styles.pill}>
                        <span className={styles.pillIcon}>👑</span>
                        <div>
                            <span className={styles.pillValue}>
                                {bestDay.xpEarned || 0}
                            </span>
                            <span className={styles.pillLabel}>
                                best day XP
                            </span>
                        </div>
                    </div>
                </div>

                {/* Chart Header */}
                <div className={styles.chartHeader}>
                    <div>
                        <h2 className={styles.chartTitle}>
                            XP Earned Over Time
                        </h2>
                        <p className={styles.chartSub}>
                            Daily experience points from routines and habits
                        </p>
                    </div>
                    <div className={styles.rangeGroup}>
                        {[7, 14, 30].map((r) => (
                            <button
                                key={r}
                                className={`${styles.rangeBtn} ${chartRange === r ? styles.rangeBtnActive : ""}`}
                                onClick={() => setChartRange(r)}
                            >
                                {r}d
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart */}
                <div className={styles.chartArea}>
                    {chartData.length === 0 ? (
                        <div className={styles.chartEmpty}>
                            <span>📈</span>
                            <p>
                                Complete routines and habits to start earning XP
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 16,
                                    left: -20,
                                    bottom: 0,
                                }}
                            >
                                <defs>
                                    <linearGradient
                                        id="xpGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#1a7a4a"
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#1a7a4a"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="rgba(26,122,74,0.08)"
                                />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fill: "#8fa898",
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}
                                    minTickGap={24}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#8fa898", fontSize: 11 }}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{
                                        stroke: "rgba(26,122,74,0.2)",
                                        strokeWidth: 1,
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="xp"
                                    stroke="#1a7a4a"
                                    strokeWidth={2.5}
                                    fill="url(#xpGradient)"
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        fill: "#1a7a4a",
                                        stroke: "#fff",
                                        strokeWidth: 2,
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Stats Row ── */}
            <div className={styles.statsRow}>
                <div
                    className={styles.statCard}
                    style={{ "--stat-color": "#ef4444" }}
                >
                    <div className={styles.statTop}>
                        <div
                            className={styles.statIconWrap}
                            style={{ background: "rgba(239,68,68,0.1)" }}
                        >
                            <span style={{ fontSize: 18 }}>🔥</span>
                        </div>
                        <span className={styles.statChange}>
                            Best: {streakInfo.bestStreak}d
                        </span>
                    </div>
                    <div className={styles.statVal}>
                        {streakInfo.currentStreak}
                    </div>
                    <div className={styles.statLbl}>Current Streak</div>
                </div>

                <div
                    className={styles.statCard}
                    style={{ "--stat-color": "#f59e0b" }}
                >
                    <div className={styles.statTop}>
                        <div
                            className={styles.statIconWrap}
                            style={{ background: "rgba(245,158,11,0.1)" }}
                        >
                            <span style={{ fontSize: 18 }}>⚡</span>
                        </div>
                    </div>
                    <div
                        className={styles.statVal}
                        style={{ color: "#f59e0b" }}
                    >
                        {levelInfo.totalXp}
                    </div>
                    <div className={styles.statLbl}>Total XP Earned</div>
                </div>

                <div
                    className={styles.statCard}
                    style={{ "--stat-color": "#1a7a4a" }}
                >
                    <div className={styles.statTop}>
                        <div
                            className={styles.statIconWrap}
                            style={{ background: "rgba(26,122,74,0.1)" }}
                        >
                            <span style={{ fontSize: 18 }}>⭐</span>
                        </div>
                    </div>
                    <div
                        className={styles.statVal}
                        style={{ color: "var(--brand-primary)" }}
                    >
                        {levelInfo.level}
                    </div>
                    <div className={styles.statLbl}>Current Level</div>
                </div>

                <div
                    className={styles.statCard}
                    style={{ "--stat-color": "#8b5cf6" }}
                >
                    <div className={styles.statTop}>
                        <div
                            className={styles.statIconWrap}
                            style={{ background: "rgba(139,92,246,0.1)" }}
                        >
                            <span style={{ fontSize: 18 }}>✨</span>
                        </div>
                    </div>
                    <div
                        className={styles.statVal}
                        style={{ color: "#8b5cf6" }}
                    >
                        {perfectDays}
                    </div>
                    <div className={styles.statLbl}>Perfect Days</div>
                </div>
            </div>

            {/* ── Level Progress ── */}
            <div className={styles.levelSection}>
                <div className={styles.levelLeft}>
                    <div className={styles.levelBadge}>
                        <div className={styles.levelBadgeInner}>
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </div>
                        <span className={styles.levelBadgeNum}>
                            Lv.{levelInfo.level}
                        </span>
                    </div>
                    <div>
                        <h3 className={styles.levelTitle}>Level Progress</h3>
                        <p className={styles.levelSub}>
                            {levelInfo.xpForNext - levelInfo.currentXp} XP until
                            Level {levelInfo.level + 1}
                        </p>
                    </div>
                </div>
                <div className={styles.levelRight}>
                    <LevelBar
                        current={levelInfo.currentXp}
                        max={levelInfo.xpForNext}
                        level={levelInfo.level}
                    />
                </div>
            </div>

            {/* ── Bottom Grid: Heatmap + Activity Feed ── */}
            <div className={styles.bottomGrid}>
                {/* Heatmap */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div>
                            <h2 className={styles.widgetTitle}>
                                Habit Consistency
                            </h2>
                            <p className={styles.widgetSub}>
                                Last 30 days of activity
                            </p>
                        </div>
                        <div className={styles.heatSummary}>
                            <span className={styles.heatSummaryNum}>
                                {perfectDays}
                            </span>
                            <span className={styles.heatSummarySub}>
                                perfect days
                            </span>
                        </div>
                    </div>
                    <Heatmap logs={dailyLogs} />
                </div>

                {/* Activity Feed */}
                <div className={styles.widget}>
                    <div className={styles.widgetHeader}>
                        <div>
                            <h2 className={styles.widgetTitle}>Activity Log</h2>
                            <p className={styles.widgetSub}>Recent XP events</p>
                        </div>
                        <div className={styles.feedTotal}>
                            <span>+{totalXpFromHistory} XP</span>
                        </div>
                    </div>
                    <div className={styles.feed}>
                        {xpHistory.length === 0 ? (
                            <div className={styles.feedEmpty}>
                                <span>📋</span>
                                <p>Complete tasks to build your activity log</p>
                            </div>
                        ) : (
                            xpHistory.slice(0, 20).map((item, idx) => {
                                const meta = getReason(item.reason);
                                const isPos = item.amount > 0;
                                return (
                                    <div
                                        key={item._id || idx}
                                        className={styles.feedItem}
                                        style={{
                                            animationDelay: `${idx * 30}ms`,
                                        }}
                                    >
                                        <div
                                            className={styles.feedIconWrap}
                                            style={{
                                                background: meta.color + "18",
                                                color: meta.color,
                                            }}
                                        >
                                            <span className={styles.feedIcon}>
                                                {meta.icon}
                                            </span>
                                        </div>
                                        <div className={styles.feedContent}>
                                            <span className={styles.feedReason}>
                                                {meta.label}
                                            </span>
                                            <span className={styles.feedTime}>
                                                {fmtDate(item.createdAt)} ·{" "}
                                                {fmtTime(item.createdAt)}
                                            </span>
                                        </div>
                                        <div
                                            className={`${styles.feedAmount} ${isPos ? styles.feedAmountPos : styles.feedAmountNeg}`}
                                        >
                                            {isPos ? "+" : ""}
                                            {item.amount} XP
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
