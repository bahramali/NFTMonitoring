import React from 'react';
import idealRanges from '../idealRangeConfig';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Label,
    ReferenceArea,
    ResponsiveContainer,
} from 'recharts';

const HistoricalPhChart = ({
    data,
    width = 600,
    height = 300,
    xDomain = [Date.now() - 24 * 60 * 60 * 1000, Date.now()],
}) => {
    const start = xDomain[0];
    const end = xDomain[1];
    const day = 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    const interval = end - start <= day * 2 ? hour : day;
    const ticks = [];
    for (let t = Math.ceil(start / interval) * interval; t <= end; t += interval) {
        ticks.push(t);
    }
    const tickFormatter = val => {
        const d = new Date(val);
        return end - start <= day * 2
            ? `${String(d.getHours()).padStart(2, '0')}`
            : `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const phRange = idealRanges.ph?.idealRange;

    return (
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
                    dataKey="time"
                    type="number"
                    domain={xDomain}
                    ticks={ticks}
                    tickFormatter={tickFormatter}
                    scale="time"
                />
                <YAxis>
                    <Label value="pH" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                </YAxis>
                {phRange && (
                    <ReferenceArea
                        y1={phRange.min}
                        y2={phRange.max}
                        x1={start}
                        x2={end}
                        fill="rgba(40,167,69,0.1)"
                        stroke="none"
                    />
                )}
                <Tooltip />
                <Line
                    type="monotone"
                    dataKey="ph"
                    stroke="#28a745"
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(HistoricalPhChart);
