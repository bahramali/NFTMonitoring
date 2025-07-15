import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';

const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
    '#00C49F', '#FFBB28', '#FF8042', '#0088FE',
    '#A28EDB', '#FF6666'
];

const bandKeys = [
    'F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'
];

const MultiBandChart = ({
    data,
    width = 600,
    height = 300,
    xDomain = [0, 23],
    yDomain = ['auto', 'auto'],
}) => {
    const start = xDomain[0];
    const end = xDomain[1];
    const ticks = [];
    for (let i = Math.ceil(start); i <= Math.floor(end); i++) {
        ticks.push(i);
    }
    return (
        <LineChart width={width} height={height} data={data} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
                dataKey="time"
                type="number"
                domain={xDomain}
                ticks={ticks}
                tickFormatter={h => String(h).padStart(2, '0')}
                interval={0}
            />
            <YAxis domain={yDomain} allowDataOverflow />
            <Tooltip />
            <Legend />
            {bandKeys.map((key, idx) => (
                <Line key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} dot={false} />
            ))}
        </LineChart>
    );
};


export default React.memo(MultiBandChart);

