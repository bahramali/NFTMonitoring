import React from "react";
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
                      }) => (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
        <LineChart margin={{ top: 20, right: 30, left: 0, bottom: 50 }} isAnimationActive={false}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
                dataKey={xDataKey}
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                tick={{ fontSize: 10 }}
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
            <YAxis>
                {yLabel && (
                    <Label value={yLabel} angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} />
                )}
            </YAxis>
            <Tooltip />
            <Legend />
            {series.map((s, i) => (
                <Line
                    key={s.name}
                    data={s.data}
                    type="monotone"
                    dataKey={s.yDataKey}
                    name={s.name}
                    stroke={s.color || palette[i % palette.length]}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                />
            ))}
            {title && (
                <text x="50%" y={0} textAnchor="middle" dominantBaseline="hanging">
                    {title}
                </text>
            )}
        </LineChart>
    </ResponsiveContainer>
);

export default React.memo(HistoryChart);
