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

const DailyTemperatureChart = ({ data, width = 600, height = 300 }) => (
    <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
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
                    <Label value="°C" angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip />
                <Line type="monotone" dataKey="temperature" stroke="#ff7300" dot={false} />
            </LineChart>
        </ResponsiveContainer>
    </div>
);

export default DailyTemperatureChart;
