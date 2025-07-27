import React from 'react';
import styles from './DeviceCard.module.css';
import idealRanges from '../idealRangeConfig';

function getRowColor(value, range) {
    if (!range) return '';
    if (typeof value !== 'number') return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) {
        return '#fff3cd';
    }
    return '';
}

function DeviceCard({ deviceId, data }) {
    const rows = [];
    for (const [field, valueObj] of Object.entries(data)) {
        if (field === 'health') continue;
        const value =
            valueObj && typeof valueObj === 'object' && 'value' in valueObj
                ? valueObj.value
                : valueObj;
        const display = typeof value === 'number' ? value.toFixed(1) : value;
        const unit =
            valueObj && typeof valueObj === 'object' ? valueObj.unit || '' : '';
        const cfg = idealRanges[field];
        rows.push(
            <tr
                key={field}
                style={{ backgroundColor: getRowColor(value, cfg?.idealRange) }}
            >
                <td>{field}</td>
                <td>
                    {display} {unit}
                </td>
                <td>{cfg?.idealRange?.min ?? '-'}</td>
                <td>{cfg?.idealRange?.max ?? '-'}</td>
            </tr>
        );
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>{deviceId}</div>
            <div className={styles.body}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Field</th>
                            <th>Value</th>
                            <th>Min</th>
                            <th>Max</th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
        </div>
    );
}

export default DeviceCard;
