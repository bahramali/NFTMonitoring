import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Label
} from 'recharts';

const DailyBandChart = ({ data, band, width = 600, height = 300 }) => (
    <LineChart width={width} height={height} data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
            dataKey="time"
            type="number"
            domain={[0, 23]}
            ticks={[...Array(24).keys()]}
            tickFormatter={h => String(h).padStart(2, '0')}
            interval={0}
        />
        <YAxis>
            <Label value="PPFD" angle={-90} position="insideLeft" />
        </YAxis>
        <Tooltip />
        <Line type="monotone" dataKey="intensity" stroke="#8884d8" dot={false} />
    </LineChart>
);

export default DailyBandChart;
