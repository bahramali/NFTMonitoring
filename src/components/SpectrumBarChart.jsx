import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Label, ReferenceArea, Cell
} from 'recharts';
import idealRanges from '../idealRangeConfig';
import palette from '../colorPalette';

const bandMeta = [
    ['F1', 'F1 (400\u2013430 nm \u2013 \u0628\u0646\u0641\u0634)'],
    ['F2', 'F2 (430\u2013460 nm \u2013 \u0622\u0628\u06cc)'],
    ['F3', 'F3 (460\u2013500 nm \u2013 \u0641\u06cc\u0631\u0648\u0632\u0647\u200c\u0627\u06cc)'],
    ['F4', 'F4 (500\u2013530 nm \u2013 \u0633\u0628\u0632)'],
    ['F5', 'F5 (530\u2013570 nm \u2013 \u0633\u0628\u0632 \u2013 \u0632\u0631\u062f)'],
    ['F6', 'F6 (570\u2013610 nm \u2013 \u0632\u0631\u062f \u2013 \u0646\u0627\u0631\u0646\u062c\u06cc)'],
    ['F7', 'F7 (610\u2013650 nm \u2013 \u0646\u0627\u0631\u0646\u062c\u06cc \u2013 \u0642\u0631\u0645\u0632)'],
    ['F8', 'F8 (650\u2013700 nm \u2013 \u0642\u0631\u0645\u0632)'],
    ['clear', '\u0637\u06cc\u0641 \u06a9\u0627\u0645\u0644 \u0646\u0648\u0631 \u0645\u0631\u0626\u06cc'],
    ['nir', 'NIR (>700 nm \u2013 \u0645\u0627\u062f\u0648\u0646 \u0642\u0631\u0645\u0632 \u0646\u0632\u062f\u06cc\u06a9)'],
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
                            fill={palette[d.index % palette.length]}
                            fillOpacity={0.1}
                            stroke="none"
                        />
                    )
                ))}
                <Tooltip />
                <Bar dataKey="value" isAnimationActive={false} animationDuration={0}>
                    {data.map((d, idx) => (
                        <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export default React.memo(SpectrumBarChart);
