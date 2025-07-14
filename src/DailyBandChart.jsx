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

const DailyBandChart = ({ data, band }) => (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis>
                    <Label value="PPFD" angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip />
                <Line type="monotone" dataKey="intensity" stroke="#8884d8" dot={false} />
            </LineChart>
        </ResponsiveContainer>
    </div>
);

export default DailyBandChart;