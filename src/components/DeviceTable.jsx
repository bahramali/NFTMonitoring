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

function DeviceTable({ devices = {} }) {
    const rows = [];
    for (const [deviceId, data] of Object.entries(devices)) {
        for (const [field, value] of Object.entries(data)) {
            if (field === 'health') continue;
            const lookup = bandMap[field] || field;
            const range = idealRanges[lookup]?.idealRange;
            const ok = data.health?.[field] ?? false;
            rows.push({ deviceId, field: lookup, range, ok });
        }
    }

    if (rows.length === 0) return null;

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Sensor</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Device ID</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={`${r.deviceId}-${r.field}`}>
                            <td>{r.field}</td>
                            <td>{r.range?.min ?? '-'}</td>
                            <td>{r.range?.max ?? '-'}</td>
                            <td>{r.deviceId}</td>
                            <td>
                                <span
                                    className={`${styles.indicator} ${r.ok ? styles.on : styles.off}`}
                                ></span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DeviceTable;
