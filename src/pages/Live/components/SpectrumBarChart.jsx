import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Label, ReferenceArea, Cell
} from 'recharts';

import { useSensorConfig } from '../../../context/SensorConfigContext.jsx';
import palette from '../../../colorPalette';
import spectralColors from '../../../spectralColors';
import styles from './SpectrumBarChart.module.css';

const legacyBandMeta = [
    ['F1', 'F1 (400–430 nm)'],
    ['F2', 'F2 (430–460 nm)'],
    ['F3', 'F3 (460–500 nm)'],
    ['F4', 'F4 (500–530 nm)'],
    ['F5', 'F5 (530–570 nm)'],
    ['F6', 'F6 (570–610 nm)'],
    ['F7', 'F7 (610–650 nm)'],
    ['F8', 'F8 (650–700 nm)'],
    ['clear', 'Full Spectrum of Visible Light'],
    ['nir', 'Near infrared'],
];

const legacyBandMap = {
    F1: '415nm',
    F2: '445nm',
    F3: '480nm',
    F4: '515nm',
    F5: '555nm',
    F6: '590nm',
    F7: '630nm',
    F8: '680nm',
};

const as7343BandMeta = [
    ['405nm', '405 nm'],
    ['425nm', '425 nm'],
    ['450nm', '450 nm'],
    ['475nm', '475 nm'],
    ['515nm', '515 nm'],
    ['550nm', '550 nm'],
    ['555nm', '555 nm'],
    ['600nm', '600 nm'],
    ['640nm', '640 nm'],
    ['690nm', '690 nm'],
    ['745nm', '745 nm'],
    ['VIS1', 'VIS1'],
    ['VIS2', 'VIS2'],
    ['NIR855', 'NIR855'],
];

function SpectrumBarChart({ sensorData }) {
    console.log('3- SPECTRUM DATA', sensorData);
    const { sensorConfigs } = useSensorConfig();

    const { bandMeta, bandMap } = useMemo(() => {
        if (!sensorData) {
            return { bandMeta: legacyBandMeta, bandMap: legacyBandMap };
        }
        const keys = Object.keys(sensorData);
        const hasAs7343 = as7343BandMeta.some(([k]) => keys.includes(k));
        return hasAs7343
            ? { bandMeta: as7343BandMeta, bandMap: {} }
            : { bandMeta: legacyBandMeta, bandMap: legacyBandMap };
    }, [sensorData]);

    const { configs } = useSensorConfig();
    const data = useMemo(() => {
        if (!sensorData) return [];
        return bandMeta.map(([key, label], index) => {
            const rangeKey = bandMap[key] || key;
            const range = configs[rangeKey]?.idealRange;
            return {
                key,
                index,
                name: label,
                value: sensorData[key] || 0,
                min: range?.min,
                max: range?.max,
            };
        });
    }, [sensorData, bandMeta, bandMap, configs]);


    return (
        <ResponsiveContainer className={styles.chart} width="100%" height={400} debounce={200}>
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
                    tick={{ fontSize: 10 }}
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
                            fill={spectralColors[d.key] || palette[d.index % palette.length]}
                            fillOpacity={0.1}
                            stroke="none"
                        />
                    )
                ))}
                <Tooltip />
                <Bar dataKey="value" isAnimationActive={false} animationDuration={0}>
                    {data.map((d, idx) => (
                        <Cell key={`cell-${idx}`} fill={spectralColors[d.key] || palette[idx % palette.length]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export default React.memo(SpectrumBarChart);
