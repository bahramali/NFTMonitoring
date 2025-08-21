import React from 'react';
import styles from './DeviceCard.module.css';
import idealRanges from '../../idealRangeConfig';

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

function DeviceCard({ compositeId, deviceId, data }) {
    const id = compositeId || deviceId;
    const rows = [];
    for (const [field, valueObj] of Object.entries(data)) {
        if (field === 'health' || field === 'controllers') continue;
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
            <div className={styles.header}>{id}</div>
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
                {Array.isArray(data.controllers) && data.controllers.length > 0 && (
                    <div className={styles.controllers}>
                        <h4>Controllers</h4>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>State</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.controllers.map((c, i) => {
                                    const name = c.name || c.controllerName || '-';
                                    const type = c.type || c.controllerType || '-';
                                    const state = c.state ?? c.value ?? c.currentState ?? '-';
                                    return (
                                        <tr key={i}>
                                            <td>{name}</td>
                                            <td>{type}</td>
                                            <td>{String(state)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeviceCard;
