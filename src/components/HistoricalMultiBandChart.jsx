import React from 'react';
import idealRanges from '../config/idealRangeConfig';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Label,
    ReferenceArea
} from 'recharts';
import spectralColors from '../constants/spectralColors';

const defaultBandKeys = [
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir', 'lux'
];

const bandMap = {
    F1: '415nm',
    F2: '445nm',
    F3: '480nm',
    F4: '515nm',
    F5: '555nm',
    F6: '590nm',
    F7: '630nm',
    F8: '680nm'
};

const HistoricalMultiBandChart = ({
    data,
    width = 600,
    height = 300,
    xDomain = [Date.now() - 24 * 60 * 60 * 1000, Date.now()],
    yDomain,
    bandKeys = defaultBandKeys,
}) => {
    const [selectedBands, setSelectedBands] = React.useState(bandKeys);

    const processedData = React.useMemo(() => {
        return (data || []).map(entry => {
            const result = { ...entry };
            for (const key of bandKeys) {
                const lookup = bandMap[key] || key;
                const range = idealRanges[lookup]?.idealRange;
                const value = Number(entry[key]);
                if (range && Number.isFinite(value)) {
                    result[`${key}Out`] = value < range.min || value > range.max;
                } else {
                    result[`${key}Out`] = false;
                }
            }
            return result;
        });
    }, [data, bandKeys]);
    const computedMax = React.useMemo(() => {
        let maxVal = 0;
        for (const entry of processedData) {
            for (const key of selectedBands) {
                const v = Number(entry[key]);
                if (v > maxVal) {
                    maxVal = v;
                }
            }
        }
        return maxVal || 1;
    }, [processedData, selectedBands]);
    const actualYDomain = yDomain || [0, computedMax];
    const start = xDomain[0];
    const end = xDomain[1];
    const day = 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    const interval = end - start <= day * 2 ? hour : day;
    const ticks = [];
    for (let t = Math.ceil(start / interval) * interval; t <= end; t += interval) {
        ticks.push(t);
    }
    const tickFormatter = (val) => {
        const d = new Date(val);
        return end - start <= day * 2
            ? `${String(d.getHours()).padStart(2, '0')}`
            : `${d.getMonth() + 1}/${d.getDate()}`;
    };
    const toggleBand = (key) => {
        setSelectedBands(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const allSelected = selectedBands.length === bandKeys.length;
    const toggleAll = () => {
        setSelectedBands(allSelected ? [] : bandKeys);
    };

    return (
        <div>
            <ResponsiveContainer width="100%" height={height} debounce={200}>
                <LineChart
                    width={width}
                    height={height}
                    data={processedData}
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
                        tick={{ fontSize: 10 }}
                    />
                    <YAxis domain={actualYDomain} allowDataOverflow>
                        <Label value="Spectrum Value" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                    </YAxis>
                    {selectedBands.map(key => {
                        const range = idealRanges[key]?.idealRange;
                        return (
                            range && (
                                <ReferenceArea
                                    key={`range-${key}`}
                                    y1={range.min}
                                    y2={range.max}
                                    x1={start}
                                    x2={end}
                                    fill={spectralColors[key]}
                                    fillOpacity={0.1}
                                    stroke="none"
                                />
                            )
                        );
                    })}
                    <Tooltip />
                    <Legend />
                    {selectedBands.map(key => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={bandMap[key] || key}
                            stroke={spectralColors[key]}
                            dot={({ payload }) =>
                                payload[`${key}Out`] ? <circle r={3} fill="red" /> : null
                            }
                            isAnimationActive={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {bandKeys.map(key => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                            type="checkbox"
                            checked={selectedBands.includes(key)}
                            onChange={() => toggleBand(key)}
                        />
                        {bandMap[key] || key}
                    </label>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    All
                </label>
            </div>
        </div>
    );
};

export default React.memo(HistoricalMultiBandChart);
