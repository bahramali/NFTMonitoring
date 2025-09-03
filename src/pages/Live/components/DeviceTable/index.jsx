import React from 'react';
import styles from './DeviceTable.module.css';
import { useSensorConfig } from '../../../../context/SensorConfigContext.jsx';
import spectralColors from '../../../../spectralColors';

function getCellColor(value, range) {
    if (!range || typeof value !== 'number' || Number.isNaN(value)) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) return '#fff3cd';
    return '';
}

function DeviceTable({devices = {}}) {
    const compositeIds = Object.keys(devices);
    const allSensors = compositeIds.flatMap(id => devices[id].sensors || []);
    const measurementTypes = new Set();
    const measurementToSensorModel = {};
    const labelMapFromData = {};
    const spectralKeyMapFromData = {};

    allSensors.forEach(s => {
        const type = s?.sensorType || s?.valueType;
        if (type) {
            measurementTypes.add(type);
            measurementToSensorModel[type] = s.sensorName || s.source || '-';

            // Label map (first letter uppercase if common)
            if (!labelMapFromData[type]) {
                const key = type;
                if (key === 'temperature') labelMapFromData[key] = 'Temp';
                else if (key === 'humidity') labelMapFromData[key] = 'Hum';
                else if (key.toLowerCase().includes('oxygen')) labelMapFromData[key] = 'DO';
                else labelMapFromData[key] = key;
            }

            // Spectral mapping if type is wavelength
            if (/^\d+nm$/.test(type)) {
                const num = type.replace('nm', '');
                const index = ['415', '445', '480', '515', '555', '590', '630', '680'].indexOf(num);
                if (index !== -1) {
                    spectralKeyMapFromData[type] = 'F' + (index + 1);
                }
            }
            if (type === 'clear') spectralKeyMapFromData[type] = 'clear';
            if (type === 'nir') spectralKeyMapFromData[type] = 'nir';
        }
    });

    if (measurementTypes.size === 0) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.emptyMessage}>No sensor data available.</div>
            </div>
        );
    }

    const { configs } = useSensorConfig();
    const rows = [...measurementTypes].map(measurementType => {
        const sensorModel = measurementToSensorModel[measurementType] || '-';
        const range = configs[measurementType]?.idealRange;
        const bandKey = spectralKeyMapFromData[measurementType];
        const rowColor = bandKey ? `${spectralColors[bandKey]}22` : undefined;

        const cells = compositeIds.map(id => {
            const s = devices[id].sensors?.find(s => (s.sensorType || s.valueType) === measurementType);
            const value = s?.value;
            const unit = s?.unit || '';
            const display = (value === undefined || value === null) ? '-' : `${typeof value === 'number' ? value.toFixed(1) : value}${unit ? ` ${unit}` : ''}`;
            const health = devices[id].health || {};
            const sensorKey = s?.sensorName?.toLowerCase();
            const ok = health[sensorKey] ?? health[s?.sensorName] ?? false;
            const color = getCellColor(value, range);
            return {display, ok, color};
        });

        return {measurementType, sensorModel, range, cells, rowColor};
    });

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th className={styles.modelCell}>S_Model</th>
                    <th className={styles.sensorCell}>M_Type</th>
                    <th className={styles.modelCell}>Min</th>
                    <th className={styles.modelCell}>Max</th>
                    {compositeIds.map(id => {
                        const dev = devices[id];
                        const label = dev?.compositeId || id;
                        return <th key={id}>{label}</th>;
                    })}
                </tr>
                </thead>
                <tbody>
                {rows.map(row => (
                    <tr key={row.measurementType}>
                        <td className={styles.modelCell}>{row.sensorModel}</td>
                        <td className={styles.sensorCell} style={{backgroundColor: row.rowColor}}>
                            {labelMapFromData[row.measurementType] || row.measurementType}
                        </td>
                        <td style={{backgroundColor: row.rowColor}}>{row.range?.min ?? '-'}</td>
                        <td style={{backgroundColor: row.rowColor}}>{row.range?.max ?? '-'}</td>
                        {row.cells.map((cell, i) => (
                            <td key={compositeIds[i]} style={{backgroundColor: cell.color}}>
                                <div className={styles.cellWrapper}>
                                    <span className={`${styles.indicator} ${cell.ok ? styles.on : styles.off}`}></span>
                                    <span className={styles.cellValue}>{cell.display}</span>
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
