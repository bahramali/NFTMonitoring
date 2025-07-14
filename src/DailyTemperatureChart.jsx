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

const DailyTemperatureChart = ({ data }) => (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" angle={-30} textAnchor="end" interval={0} height={60} />
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
