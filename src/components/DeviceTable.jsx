import React from 'react';
import styles from './DeviceTable.module.css';
import idealRanges from '../idealRangeConfig';

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

    const rows = Array.from(sensorSet).map(sensor => {
        const orig = reverseBandMap[sensor] || sensor;
        const range = idealRanges[sensor]?.idealRange;
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
            return { value: display, ok };
        });
        return { sensor, range, cells };
    });

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
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
                            <td>{r.sensor}</td>
                            <td>{r.range?.min ?? '-'}</td>
                            <td>{r.range?.max ?? '-'}</td>
                            {r.cells.map((c, i) => (
                                <td key={deviceIds[i]}>
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
