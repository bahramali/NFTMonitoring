import React from 'react';
import idealRanges from '../idealRangeConfig';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Label,
    ReferenceArea
} from 'recharts';

const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
    '#00C49F', '#FFBB28', '#FF8042', '#0088FE',
    '#A28EDB', '#FF6666'
];

const bandKeys = [
    'F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'
];

const HistoricalMultiBandChart = ({
    data,
    width = 600,
    height = 300,
    xDomain = [Date.now() - 24 * 60 * 60 * 1000, Date.now()],
    yDomain = [0, 2100],
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
    const tickFormatter = (val) => {
        const d = new Date(val);
        return end - start <= day * 2
            ? `${String(d.getHours()).padStart(2, '0')}`
            : `${d.getMonth() + 1}/${d.getDate()}`;
    };
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
                <YAxis domain={yDomain} allowDataOverflow>
                    <Label value="Spectrum Value" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                </YAxis>
                {bandKeys.map((key, idx) => {
                    const range = idealRanges[key]?.idealRange;
                    return (
                        range && (
                            <ReferenceArea
                                key={`range-${key}`}
                                y1={range.min}
                                y2={range.max}
                                x1={start}
                                x2={end}
                                fill={colors[idx % colors.length]}
                                fillOpacity={0.1}
                                stroke="none"
                            />
                        )
                    );
                })}
                <Tooltip />
                <Legend />
                {bandKeys.map((key, idx) => (
                    <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={colors[idx % colors.length]}
                        dot={false}
                        isAnimationActive={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(HistoricalMultiBandChart);
