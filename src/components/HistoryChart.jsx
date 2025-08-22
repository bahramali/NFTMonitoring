import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Label,
    ResponsiveContainer,
} from 'recharts';
import palette from '../colorPalette';

const HistoryChart = ({
    data,
    xDataKey,
    yDataKey,
    yLabel,
    title,
    width = 600,
    height = 300,
}) => (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
        <LineChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 50 }}
            isAnimationActive={false}
        >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
                dataKey={xDataKey}
                type="number"
                domain={['auto', 'auto']}
                scale="time"
                tick={{ fontSize: 10 }}
                tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
            />
            <YAxis>
                {yLabel && (
                    <Label value={yLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                )}
            </YAxis>
            <Tooltip />
            <Line
                type="monotone"
                dataKey={yDataKey}
                stroke={palette[4]}
                dot={false}
                isAnimationActive={false}
            />
            {title && (
                <text x={width / 2} y={0} textAnchor="middle" dominantBaseline="hanging">
                    {title}
                </text>
            )}
        </LineChart>
    </ResponsiveContainer>
);

export default React.memo(HistoryChart);

