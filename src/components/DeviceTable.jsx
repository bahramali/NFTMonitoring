import React from 'react';
import styles from './DeviceTable.module.css';
import idealRanges from '../idealRangeConfig';

function getCellColor(value, range) {
    if (!range) return '';
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) {
        return '#fff3cd';
    }
    return '';
}

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

// Map each data field to the sensor name responsible for it so that
// the health indicator can reference the correct status key.
const sensorFieldMap = {
    veml7700: ['lux'],
    sht3x: ['temperature', 'humidity'],
    as7341: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'],
    tds: ['tds', 'ec'],
    ph: ['ph']
};

const fieldToSensor = Object.fromEntries(
    Object.entries(sensorFieldMap).flatMap(([sensor, fields]) =>
        fields.map(f => [f, sensor])
    )
);

const sensorModelMap = {
    temperature: 'SHT3x',
    humidity: 'SHT3x',
    lux: 'VEML7700',
    tds: 'version 1.0',
    ec: 'version 1.0',
    ph: 'E-201',
};

for (const b of Object.values(bandMap)) {
    sensorModelMap[b] = 'AS7341';
}
sensorModelMap.clear = 'AS7341';
sensorModelMap.nir = 'AS7341';

function DeviceTable({ devices = {} }) {
    const deviceIds = Object.keys(devices);
    if (deviceIds.length === 0) return null;

    const reverseBandMap = Object.fromEntries(
        Object.entries(bandMap).map(([k, v]) => [v, k])
    );

    const sensorSet = new Set();
    for (const data of Object.values(devices)) {
        for (const key of Object.keys(data)) {
            if (key === 'health') continue;
            sensorSet.add(bandMap[key] || key);
        }
    }

    const orderedModels = [
        'SHT3x',
        'VEML7700',
        'version 1.0',
        'E-201',
        'AS7341',
    ];

    const modelGroups = Object.fromEntries(orderedModels.map(m => [m, []]));

    for (const sensor of sensorSet) {
        const orig = reverseBandMap[sensor] || sensor;
        const model = sensorModelMap[orig] || 'AS7341';
        modelGroups[model].push(sensor);
    }

    const orderedSensors = orderedModels.flatMap(m => modelGroups[m]);

    const rows = orderedSensors.map(sensor => {
        const orig = reverseBandMap[sensor] || sensor;
        const range = idealRanges[sensor]?.idealRange;
        const model = sensorModelMap[orig] || 'AS7341';
        const cells = deviceIds.map(id => {
            const valObj = devices[id]?.[orig];
            const value =
                valObj && typeof valObj === 'object' && 'value' in valObj
                    ? valObj.value
                    : valObj;
            const display =
                typeof value === 'number' ? value.toFixed(1) : value;
            const sensorName = fieldToSensor[orig] || orig;
            const ok = devices[id]?.health?.[sensorName] ?? false;
            const color = getCellColor(value, range);
            return { value: display, ok, color };
        });
        return { sensor, range, cells, model };
    });

    const modelCounts = {};
    for (const r of rows) {
        modelCounts[r.model] = (modelCounts[r.model] || 0) + 1;
    }

    const seenModel = {};
    for (const r of rows) {
        if (!seenModel[r.model]) {
            r.rowSpan = modelCounts[r.model];
            seenModel[r.model] = true;
        } else {
            r.rowSpan = 0;
        }
    }

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Sensor model</th>
                        <th>Sensor</th>
                        <th>Min</th>
                        <th>Max</th>
                        {deviceIds.map(id => (
                            <th key={id}>{id}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.sensor}>
                            {r.rowSpan > 0 && <td rowSpan={r.rowSpan}>{r.model}</td>}
                            <td>{r.sensor}</td>
                            <td>{r.range?.min ?? '-'}</td>
                            <td>{r.range?.max ?? '-'}</td>
                            {r.cells.map((c, i) => (
                                <td key={deviceIds[i]} style={{ backgroundColor: c.color }}>
                                    <div className={styles.cellWrapper}>
                                        <span
                                            className={`${styles.indicator} ${c.ok ? styles.on : styles.off}`}
                                        ></span>
                                        <span className={styles.cellValue}>{c.value ?? '-'}</span>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DeviceTable;
