import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Label, ReferenceArea
} from 'recharts';
import idealRanges from '../idealRangeConfig';

const bandMeta = [
    ['F1', '415 nm (F1)'],
    ['F2', '445 nm (F2)'],
    ['F3', '480 nm (F3)'],
    ['F4', '515 nm (F4)'],
    ['F5', '555 nm (F5)'],
    ['F6', '590 nm (F6)'],
    ['F7', '630 nm (F7)'],
    ['F8', '680 nm (F8)'],
    ['clear', 'Clear'],
    ['nir', 'NIR'],
];

const bandMap = {
    F1: '415nm',
    F2: '445nm',
    F3: '480nm',
    F4: '515nm',
    F5: '555nm',
    F6: '590nm',
    F7: '630nm',
    F8: '680nm',
};

function SpectrumBarChart({ sensorData }) {
    const data = useMemo(
        () =>
            bandMeta.map(([key, label], index) => {
                const rangeKey = bandMap[key] || key;
                const range = idealRanges[rangeKey]?.idealRange;
                return {
                    index,
                    name: label,
                    value: sensorData[key] || 0,
                    min: range?.min,
                    max: range?.max,
                };
            }),
        [sensorData]
    );

    return (
        <ResponsiveContainer width="100%" height={400} debounce={200}>
            <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 0, bottom: 50 }}
                isAnimationActive={false}
                animationDuration={0}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="index"
                    type="number"
                    domain={[-0.5, data.length - 0.5]}
                    ticks={data.map(d => d.index)}
                    tickFormatter={(i) => data[i]?.name}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    height={60}
                />
                <YAxis domain={[0, 900]} allowDataOverflow>
                    <Label value="Raw Intensity" angle={-90} position="insideLeft" />
                </YAxis>
                {data.map(d => (
                    d.min !== undefined && d.max !== undefined && (
                        <ReferenceArea
                            key={`range-${d.index}`}
                            x1={d.index - 0.5}
                            x2={d.index + 0.5}
                            y1={d.min}
                            y2={d.max}
                            fill="rgba(0, 0, 255, 0.1)"
                            stroke="none"
                        />
                    )
                ))}
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" isAnimationActive={false} animationDuration={0} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export default React.memo(SpectrumBarChart);
