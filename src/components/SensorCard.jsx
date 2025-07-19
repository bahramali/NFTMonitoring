import React from 'react';
import styles from './SensorCard.module.css';
import idealRanges from '../idealRangeConfig';

function getRowColor(value, range) {
    if (!range) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    if (value < range.min + 10 || value > range.max - 10) return '#fff3cd';
    return '';
}

function SensorCard({ name, ok, fields = [], sensorData }) {
    const descriptions = [];

    const rows = fields.map(field => {
        const data = sensorData[field];
        const value =
            data && typeof data === 'object' && 'value' in data ? data.value : data;
        const display = typeof value === 'number' ? value.toFixed(1) : value;
        const unit = data && typeof data === 'object' ? data.unit || '' : '';
        const cfg = idealRanges[field];
        if (cfg?.description) {
            descriptions.push(`${field}: ${cfg.description}`);
        }
        return (
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
    });

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span>{name}</span>
                <span className={`${styles.indicator} ${ok ? styles.on : styles.off}`} />
            </div>
            <div className={styles.body}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Unit</th>
                            <th>Value</th>
                            <th>Min</th>
                            <th>Max</th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
                {descriptions.length > 0 && (
                    <div className={styles.note}>{descriptions.join(' ')}</div>
                )}
            </div>
        </div>
    );
}

export default SensorCard;
