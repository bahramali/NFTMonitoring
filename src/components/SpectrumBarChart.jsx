import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Label
} from 'recharts';

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

function SpectrumBarChart({ sensorData }) {
    const data = useMemo(
        () => bandMeta.map(([key, label]) => ({ name: label, value: sensorData[key] || 0 })),
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
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis>
                    <Label value="Raw Intensity" angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" isAnimationActive={false} animationDuration={0} />
            </BarChart>
        </ResponsiveContainer>
    );
}

export default React.memo(SpectrumBarChart);
