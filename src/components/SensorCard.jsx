import React from 'react';
import styles from './SensorCard.module.css';
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

function getRowColor(value, range) {
    if (!range) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) {
        return '#fff3cd';
    }
    return '';
}

function SensorCard({ name, ok, fields = [], sensorData }) {
    const cardData = {};
    for (const f of fields) {
        cardData[f] = sensorData[f];
    }
    console.log('🖼️ Rendering SensorCard for', name, cardData);
    const descriptions = [];

    const rows = fields.map(field => {
        const lookup = bandMap[field] || field;
        const data = sensorData[field];
        const value =
            data && typeof data === 'object' && 'value' in data ? data.value : data;
        const display = typeof value === 'number' ? value.toFixed(1) : value;
        const unit = data && typeof data === 'object' ? data.unit || '' : '';
        const cfg = idealRanges[lookup];
        if (cfg?.description) {
            descriptions.push(`${lookup}: ${cfg.description}`);
        }
        return (
            <tr
                key={field}
                style={{ backgroundColor: getRowColor(value, cfg?.idealRange) }}
            >
                <td>{lookup}</td>
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
                <span className={styles.name}>{name.toUpperCase()}</span>
                <span className={`${styles.indicator} ${ok ? styles.on : styles.off}`} />
            </div>
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

export default SensorCard;
