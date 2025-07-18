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
    Legend,
    ResponsiveContainer,
} from 'recharts';

const HistoricalEcTdsChart = ({
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

    const ecRange = idealRanges.ec?.idealRange;
    const tdsRange = idealRanges.tds?.idealRange;

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
                <YAxis yAxisId="left">
                    <Label value="TDS (ppm)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                </YAxis>
                <YAxis yAxisId="right" orientation="right">
                    <Label value="EC (mS/cm)" angle={-90} position="insideRight" style={{ textAnchor: 'middle' }} />
                </YAxis>
                {tdsRange && (
                    <ReferenceArea
                        yAxisId="left"
                        y1={tdsRange.min}
                        y2={tdsRange.max}
                        x1={start}
                        x2={end}
                        fill="rgba(0,123,255,0.1)"
                        stroke="none"
                    />
                )}
                {ecRange && (
                    <ReferenceArea
                        yAxisId="right"
                        y1={ecRange.min}
                        y2={ecRange.max}
                        x1={start}
                        x2={end}
                        fill="rgba(255,193,7,0.1)"
                        stroke="none"
                    />
                )}
                <Tooltip />
                <Legend />
                <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="tds"
                    stroke="#007bff"
                    dot={false}
                    isAnimationActive={false}
                />
                <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ec"
                    stroke="#ffc107"
                    dot={false}
                    isAnimationActive={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default React.memo(HistoricalEcTdsChart);
