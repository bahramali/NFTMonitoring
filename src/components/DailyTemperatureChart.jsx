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
    ReferenceArea
} from 'recharts';

const DailyTemperatureChart = ({
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

    return (
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
                <Label value="Temp (°C) / Humidity (%)" angle={-90} position="insideLeft" />
            </YAxis>
            {(() => {
                const tRange = idealRanges.temperature?.idealRange;
                const hRange = idealRanges.humidity?.idealRange;
                return (
                    <>
                        {tRange && (
                            <ReferenceArea
                                y1={tRange.min}
                                y2={tRange.max}
                                x1={start}
                                x2={end}
                                fill="rgba(255,115,0,0.1)"
                                stroke="none"
                            />
                        )}
                        {hRange && (
                            <ReferenceArea
                                y1={hRange.min}
                                y2={hRange.max}
                                x1={start}
                                x2={end}
                                fill="rgba(136,132,216,0.1)"
                                stroke="none"
                            />
                        )}
                    </>
                );
            })()}
            <Tooltip />
            <Line
                type="monotone"
                dataKey="temperature"
                stroke="#ff7300"
                dot={false}
                isAnimationActive={false}
            />
            <Line
                type="monotone"
                dataKey="humidity"
                stroke="#8884d8"
                dot={false}
                isAnimationActive={false}
            />
        </LineChart>
    );
};

export default React.memo(DailyTemperatureChart);
