import React, { useMemo } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Label, ResponsiveContainer, Legend,
} from "recharts";
import palette from "../colorPalette";

/**
 * Props:
 * - xDataKey: string (e.g., 'time')
 * - series: Array<{ name: string; data: any[]; yDataKey: string; color?: string }>
 * - yLabel: string
 * - title?: string
 * - height?: number
 * - xDomain?: [number, number]
 */
const HistoryChart = ({
                          xDataKey,
                          series = [],
                          yLabel,
                          title,
                          height = 300,
                          xDomain,
                      }) => {
    const mergedData = useMemo(() => {
        if (!series.length) return [];

        const pointMap = new Map();
        for (const currentSeries of series) {
            if (!currentSeries?.data?.length) continue;

            for (const point of currentSeries.data) {
                const key = point?.[xDataKey];
                if (key === undefined || key === null) continue;

                const existing = pointMap.get(key) ?? { [xDataKey]: key };
                if (currentSeries.yDataKey in point) {
                    existing[currentSeries.yDataKey] = point[currentSeries.yDataKey];
                }
                pointMap.set(key, existing);
            }
        }

        return Array.from(pointMap.values()).sort((a, b) => a[xDataKey] - b[xDataKey]);
    }, [series, xDataKey]);

    return (
        <ResponsiveContainer width="100%" height={height} debounce={200}>
            <LineChart
                data={mergedData}
                margin={{ top: 20, right: 30, left: 12, bottom: 50 }}
                isAnimationActive={false}
            >
                <CartesianGrid stroke="#1f2a44" strokeDasharray="4 4" />
                <XAxis
                    dataKey={xDataKey}
                    type="number"
                    scale="time"
                    domain={xDomain ?? ["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "#d0dcff" }}
                    stroke="#2b3c5c"
                    tickFormatter={(val) => {
                        const d = new Date(val);
                        const formatOptions = {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                        };
                        return new Intl.DateTimeFormat("en-US", formatOptions).format(d);
                    }}
                    allowDataOverflow
                />
                <YAxis
                    tick={{ fontSize: 11, fill: "#d0dcff" }}
                    stroke="#2b3c5c"
                    tickLine={{ stroke: "#2b3c5c" }}
                >
                    {yLabel && (
                        <Label
                            value={yLabel}
                            angle={-90}
                            position="insideLeft"
                            style={{ textAnchor: "middle", fill: "#c4d8ff", fontSize: 12 }}
                        />
                    )}
                </YAxis>
                <Tooltip
                    cursor={{ stroke: "#6f9bff", strokeDasharray: "5 5" }}
                    contentStyle={{
                        backgroundColor: "rgba(7, 15, 32, 0.94)",
                        border: "1px solid #31507f",
                        borderRadius: 8,
                        color: "#e4ecff",
                        boxShadow: "0 12px 28px rgba(4, 11, 26, 0.55)",
                    }}
                    labelStyle={{ color: "#9fb6ff" }}
                    itemStyle={{ color: "#e4ecff" }}
                />
                <Legend
                    wrapperStyle={{
                        paddingTop: 12,
                        color: "#d0dcff",
                    }}
                />
                {series.map((s, i) => (
                    <Line
                        key={s.name}
                        type="monotone"
                        dataKey={s.yDataKey}
                        name={s.name}
                        stroke={s.color || palette[i % palette.length]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                    />
                ))}
                {title && (
                    <text
                        x="50%"
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fill="#f0f5ff"
                        style={{ fontSize: 14, letterSpacing: "0.04em" }}
                    >
                        {title}
                    </text>
                )}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(HistoryChart);
