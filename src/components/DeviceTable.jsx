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
                        <th>
                            <div className={styles.cellTop}>Device ID</div>
                            <div className={styles.divider}></div>
                            <div className={styles.cellBottom}>Status</div>
                        </th>
                        {fields.map(f => (
                            <th key={f}>
                                <div className={styles.cellTop}>{f}</div>
                                <div className={styles.divider}></div>
                                <div className={styles.cellBottom}>Value</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([id, data]) => (
                        <tr key={id}>
                            <td>
                                <div className={styles.cellTop}>{id}</div>
                                <div className={styles.divider}></div>
                                <div className={styles.cellBottom}>status</div>
                            </td>
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
                                const ok = data.health?.[field] ?? false;
                                return (
                                    <td key={field}>
                                        <div className={styles.cellTop}>
                                            <span
                                                className={`${styles.indicator} ${
                                                    ok ? styles.on : styles.off
                                                }`}
                                            ></span>
                                        </div>
                                        <div className={styles.divider}></div>
                                        <div className={styles.cellBottom}>
                                            {display}
                                            {unit}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default DeviceTable;
