import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Label,
    ResponsiveContainer,
} from 'recharts';
import palette from '../colorPalette';

const HistoryChart = ({
                          data,
                          xDataKey,
                          yDataKey,
                          yLabel,
                          title,
                          height = 300,
                          xDomain,
                      }) => (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
        <LineChart
            data={data}
            margin={{top: 20, right: 30, left: 0, bottom: 50}}
            isAnimationActive={false}
        >
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis
                dataKey={xDataKey}
                type="number"
                scale="time"
                domain={xDomain ?? ['auto', 'auto']}   // <— use given domain
                tick={{fontSize: 10}}
                tickFormatter={(val) => {
                    const d = new Date(val);
                    // show hh:mm if range is short (fallback simple)
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                allowDataOverflow   // <— keep axis exactly on domain
            />
            <YAxis>
                {yLabel && <Label value={yLabel} angle={-90} position="insideLeft" style={{textAnchor: 'middle'}}/>}
            </YAxis>
            <Tooltip/>
            <Line
                type="monotone"
                dataKey={yDataKey}
                stroke={palette[4]}
                dot={false}
                isAnimationActive={false}
            />
            {title && <text x="50%" y={0} textAnchor="middle" dominantBaseline="hanging">{title}</text>}
        </LineChart>
    </ResponsiveContainer>
);

export default React.memo(HistoryChart);

