import React from 'react';
import styles from './DeviceTable.module.css';
import idealRanges from '../idealRangeConfig';
import spectralColors from '../spectralColors';

function getCellColor(value, range) {
    if (!range || typeof value !== 'number' || Number.isNaN(value)) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) return '#fff3cd';
    return '';
}

function DeviceTable({devices = {}}) {
    const deviceIds = Object.keys(devices);
    const allSensors = deviceIds.flatMap(id => devices[id].sensors || []);

    const measurementTypes = new Set();
    const measurementToSensorModel = {};
    const labelMapFromData = {};
    const spectralKeyMapFromData = {};

    allSensors.forEach(s => {
        if (s?.valueType) {
            measurementTypes.add(s.valueType);
            measurementToSensorModel[s.valueType] = s.sensorName || s.source || '-';

            // Label map (first letter uppercase if common)
            if (!labelMapFromData[s.valueType]) {
                const key = s.valueType;
                if (key === 'temperature') labelMapFromData[key] = 'Temp';
                else if (key === 'humidity') labelMapFromData[key] = 'Hum';
                else if (key.toLowerCase().includes('oxygen')) labelMapFromData[key] = 'DO';
                else labelMapFromData[key] = key;
            }

            // Spectral mapping if type is wavelength
            if (/^\d+nm$/.test(s.valueType)) {
                const num = s.valueType.replace('nm', '');
                const index = ['415', '445', '480', '515', '555', '590', '630', '680'].indexOf(num);
                if (index !== -1) {
                    spectralKeyMapFromData[s.valueType] = 'F' + (index + 1);
                }
            }
            if (s.valueType === 'clear') spectralKeyMapFromData[s.valueType] = 'clear';
            if (s.valueType === 'nir') spectralKeyMapFromData[s.valueType] = 'nir';
        }
    });

    if (measurementTypes.size === 0) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.emptyMessage}>No sensor data available.</div>
            </div>
        );
    }

    const rows = [...measurementTypes].map(measurementType => {
        const sensorModel = measurementToSensorModel[measurementType] || '-';
        const range = idealRanges[measurementType]?.idealRange;
        const bandKey = spectralKeyMapFromData[measurementType];
        const rowColor = bandKey ? `${spectralColors[bandKey]}22` : undefined;

        const cells = deviceIds.map(id => {
            const s = devices[id].sensors?.find(s => s.valueType === measurementType);
            const value = s?.value;
            const unit = s?.unit || '';
            const display = (value === undefined || value === null) ? '-' : `${typeof value === 'number' ? value.toFixed(1) : value}${unit ? ` ${unit}` : ''}`;
            const ok = devices[id].health?.[s?.sensorName] ?? false;
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
                    {deviceIds.map(id => <th key={id}>Val {id}</th>)}
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
                            <td key={deviceIds[i]} style={{backgroundColor: cell.color}}>
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
