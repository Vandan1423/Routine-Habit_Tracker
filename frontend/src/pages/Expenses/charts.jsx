import { useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import useAppearance from "../../hooks/useAppearance";
import { formatMonth, formatMonthShort } from "../../lib/dates";
import { categoryLabel } from "../../lib/expenseWords";
import { DURATION } from "../../lib/motion";
import { compactMoney, formatMoney } from "../../lib/money";
import styles from "./charts.module.css";

// The three pictures on the Expenses screen, drawn with Recharts and coloured from the tokens: ink for
// the marks, hairlines for the scale, and nothing told apart by hue. Each is fetched apart from the
// screen, which shows a quiet block of the same height until it arrives.

const SLOW_MS = DURATION.slow * 1000;

const percent = (share) => `${Math.round(share * 100)}%`;

/**
 * Whether a chart moves when what it shows changes. It never moves on arriving: it is simply there.
 * After that a change of month is drawn as a change, unless the reader has asked for less motion.
 */
const useMovesOnChange = (data) => {
    const { reducedMotion } = useAppearance();
    const [arrivedWith] = useState(data);

    return !reducedMotion && data !== arrivedWith;
};

// What is said beside the pointer: a name, and the figure that belongs to it
const Tip = ({ active, payload, render }) =>
    active && payload?.length ? <div className={styles.tip}>{render(payload[0].payload)}</div> : null;

// A point on the line: the month on show is filled in, the others are open
const MonthDot = ({ cx, cy, payload }) =>
    Number.isFinite(cx) && Number.isFinite(cy) ? (
        <circle
            className={payload.shown ? styles.dotShown : styles.dot}
            cx={cx}
            cy={cy}
            r={payload.shown ? 3.5 : 2.5}
        />
    ) : null;

const MONTHS_HEIGHT = 148;

/**
 * Six months of spending as one line, ending at the month on show. Pressing a month turns to it.
 *
 * series: from buildExpenseMonth. onSelect(month): a month was pressed.
 */
export const MonthsChart = ({ series, currency, onSelect }) => {
    const moves = useMovesOnChange(series);
    const data = series.map((point) => ({ ...point, label: formatMonthShort(point.month) }));

    return (
        <figure className={styles.chart}>
            <ResponsiveContainer width="100%" height={MONTHS_HEIGHT}>
                <AreaChart
                    data={data}
                    title="Spending, month by month"
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                    // A month can be pressed
                    style={{ cursor: "pointer" }}
                    onClick={(state) => {
                        const point = data[Number(state?.activeTooltipIndex ?? state?.activeIndex)];
                        if (point) onSelect?.(point.month);
                    }}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
                    <YAxis
                        width={48}
                        tickCount={3}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => compactMoney(value, currency)}
                    />
                    <Tooltip
                        isAnimationActive={false}
                        cursor={{ className: styles.cursorLine }}
                        content={
                            <Tip
                                render={(point) => (
                                    <>
                                        <span>{formatMonth(point.month)}</span>
                                        <b>{formatMoney(point.total, currency)}</b>
                                    </>
                                )}
                            />
                        }
                    />
                    <Area
                        className={styles.line}
                        type="monotone"
                        dataKey="total"
                        dot={<MonthDot />}
                        activeDot={{ className: styles.dotActive, r: 4 }}
                        isAnimationActive={moves}
                        animationDuration={SLOW_MS}
                        animationEasing="ease-out"
                    />
                </AreaChart>
            </ResponsiveContainer>
            <figcaption className="visually-hidden">
                {data.map((point) => `${formatMonth(point.month)}: ${formatMoney(point.total, currency)}`).join(". ")}
            </figcaption>
        </figure>
    );
};

const CATEGORY_ROW = 30;
// Room for the longest category name at the size it is set in, and a gap before its bar
const CATEGORY_NAMES = 128;

// A category's name, set against the left edge like every other label on the page
const CategoryTick = ({ y, payload }) => (
    <text className={styles.categoryName} x={0} y={y} dy="0.35em" textAnchor="start">
        {payload.value}
    </text>
);

/**
 * Where the month went: one bar for each category that took anything, longest first.
 *
 * categories: from buildExpenseMonth
 */
export const CategoryChart = ({ categories, currency }) => {
    const moves = useMovesOnChange(categories);
    const data = categories.map((entry) => ({ ...entry, label: categoryLabel(entry.category) }));

    return (
        <figure className={styles.chart}>
            <ResponsiveContainer width="100%" height={data.length * CATEGORY_ROW}>
                <BarChart
                    data={data}
                    title="Spending by category"
                    layout="vertical"
                    margin={{ top: 0, right: 76, bottom: 0, left: 0 }}
                >
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis
                        type="category"
                        dataKey="label"
                        width={CATEGORY_NAMES}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tick={<CategoryTick />}
                    />
                    <Tooltip
                        isAnimationActive={false}
                        cursor={{ className: styles.cursorBand }}
                        content={
                            <Tip
                                render={(entry) => (
                                    <>
                                        <span>{entry.label}</span>
                                        <b>{percent(entry.share)} of the month</b>
                                    </>
                                )}
                            />
                        }
                    />
                    <Bar
                        className={styles.bar}
                        dataKey="total"
                        barSize={8}
                        radius={2}
                        minPointSize={2}
                        isAnimationActive={moves}
                        animationDuration={SLOW_MS}
                        animationEasing="ease-out"
                    >
                        <LabelList
                            className={styles.amount}
                            dataKey="total"
                            position="right"
                            offset={10}
                            formatter={(value) => formatMoney(value, currency)}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <figcaption className="visually-hidden">
                {data.map((entry) => `${entry.label}: ${formatMoney(entry.total, currency)}`).join(". ")}
            </figcaption>
        </figure>
    );
};

// How strongly each slice is inked, from the largest down. What is left over is drawn as an empty track.
const INK = [1, 0.72, 0.52, 0.36, 0.24];

/**
 * Where the month was spent: the places with a name as slices of one ring, in order of size, with
 * everything else as the rest of the ring. The same order and the same ink are used in the list beside it.
 *
 * places: from buildExpenseMonth; the one without a name is "everywhere else"
 */
export const PlacesChart = ({ places, currency }) => {
    const moves = useMovesOnChange(places);
    const data = places.map((place, index) => ({ ...place, label: place.name ?? "Everywhere else", index }));

    return (
        <div className={styles.places}>
            <figure className={styles.ring}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart title="Spending by place">
                        <Tooltip
                            isAnimationActive={false}
                            content={
                                <Tip
                                    render={(place) => (
                                        <>
                                            <span>{place.label}</span>
                                            <b>{percent(place.share)}</b>
                                        </>
                                    )}
                                />
                            }
                        />
                        <Pie
                            data={data}
                            dataKey="total"
                            nameKey="label"
                            innerRadius="62%"
                            outerRadius="100%"
                            startAngle={90}
                            endAngle={-270}
                            // The chart itself is the stop for the keyboard, and it has a name; the ring inside it has none
                            rootTabIndex={-1}
                            isAnimationActive={moves}
                            animationDuration={SLOW_MS}
                            animationEasing="ease-out"
                        >
                            {data.map((place) => (
                                <Cell
                                    key={place.label}
                                    className={place.name === null ? styles.sliceRest : styles.slice}
                                    fillOpacity={place.name === null ? 1 : INK[place.index]}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </figure>
            <ul className={styles.legend}>
                {data.map((place) => (
                    <li key={place.label} className={styles.place}>
                        <i
                            className={place.name === null ? styles.keyRest : styles.key}
                            style={place.name === null ? undefined : { opacity: INK[place.index] }}
                            aria-hidden="true"
                        />
                        <span className={styles.placeName}>{place.label}</span>
                        <span className={styles.placeTotal}>{formatMoney(place.total, currency)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
