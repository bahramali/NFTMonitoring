import React from 'react';
import styles from './DeviceTable.module.css';

function DeviceTable({ devices = {} }) {
    const entries = Object.entries(devices);
    if (entries.length === 0) {
        return null;
    }
    const fieldSet = new Set();
    for (const [, data] of entries) {
        for (const key of Object.keys(data)) {
            if (key === 'health') continue;
            fieldSet.add(key);
        }
    }
    const fields = Array.from(fieldSet);

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Device ID</th>
                        {fields.map(f => (
                            <th key={f}>{f}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([id, data]) => (
                        <tr key={id}>
                            <td>{id}</td>
                            {fields.map(field => {
                                const valObj = data[field];
                                const value =
                                    valObj && typeof valObj === 'object' && 'value' in valObj
                                        ? valObj.value
                                        : valObj;
                                const display =
                                    value === undefined || value === null
                                        ? '-'
                                        : typeof value === 'number'
                                        ? value.toFixed(1)
                                        : value;
                                const unit =
                                    valObj && typeof valObj === 'object' && valObj.unit
                                        ? ` ${valObj.unit}`
                                        : '';
                                return <td key={field}>{display}{unit}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DeviceTable;
