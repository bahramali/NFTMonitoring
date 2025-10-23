import React from 'react';
import { useSensorConfig } from '../../../../context/SensorConfigContext.jsx';
import spectralColors from '../../../../spectralColors';
import styles from './DeviceTable.module.css';

function sanitize(value) {
    if (value === undefined || value === null) return '';
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSpectralBandKey(measurementType) {
    const normalized = sanitize(measurementType);
    if (!normalized) return undefined;

    const nmMatch = normalized.match(/^(\d+)nm$/);
    if (nmMatch) {
        const index = ['415', '445', '480', '515', '555', '590', '630', '680'].indexOf(nmMatch[1]);
        if (index !== -1) return `F${index + 1}`;
    }

    if (normalized === 'clear') return 'clear';
    if (normalized === 'nir') return 'nir';
    return undefined;
}

function getCellColor(value, range) {
    if (!range || typeof value !== 'number' || Number.isNaN(value)) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) return '#fff3cd';
    return '';
}

function getMeasurementLabel(measurementType, sensorModel) {
    const normalizedType = measurementType?.toLowerCase?.();
    const normalizedModel = sensorModel?.toLowerCase?.();
    const sanitizedModel = normalizedModel?.replace(/[^a-z0-9]/g, '');

    const matchesModel = target => {
        if (!sanitizedModel) return false;
        const sanitizedTarget = target.replace(/[^a-z0-9]/g, '');
        return sanitizedModel === sanitizedTarget || sanitizedModel.includes(sanitizedTarget);
    };

    if (normalizedType === 'temperature') {
        if (matchesModel('ds18b20')) return 'D_Temp';
        if (matchesModel('sht3x')) return 'A_Temp';
        if (matchesModel('hdc302x')) return 'G_Temp';
        return 'Temp';
    }

    if (normalizedType === 'humidity') {
        if (matchesModel('sht3x')) return 'A_RH';
        if (matchesModel('hdc302x')) return 'G_RH';
        return 'Hum';
    }
    if (normalizedType?.includes('oxygen')) return 'DO';

    return measurementType;
}

function DeviceTable({devices = {}}) {
    const { configs } = useSensorConfig();
    const compositeIds = Object.keys(devices);
    const allSensors = compositeIds.flatMap(id => devices[id].sensors || []);
    const measurementEntries = new Map();

    allSensors.forEach(sensor => {
        const measurementType = sensor?.sensorType || sensor?.valueType;
        if (!measurementType) return;

        const sensorModel = sensor?.sensorName || sensor?.source || '-';
        const normalizedType = sanitize(measurementType);
        const normalizedModel = sanitize(sensorModel) || normalizedType;
        const key = `${normalizedType}|${normalizedModel}`;

        if (!measurementEntries.has(key)) {
            measurementEntries.set(key, {
                measurementType,
                sensorModel,
                normalizedType,
                normalizedModel,
                bandKey: getSpectralBandKey(measurementType),
            });
        }
    });

    if (measurementEntries.size === 0) {
        return (
            <div className={styles.wrapper}>
                <div className={styles.emptyMessage}>No sensor data available.</div>
            </div>
        );
    }

    const rows = [...measurementEntries.values()].map(entry => {
        let range = configs[entry.measurementType]?.idealRange
            ?? configs[entry.measurementType?.toLowerCase?.()]?.idealRange;
        if (!range) {
            const matchedConfigKey = Object.keys(configs).find(key => sanitize(key) === entry.normalizedType);
            if (matchedConfigKey) range = configs[matchedConfigKey]?.idealRange;
        }
        const rowColor = entry.bandKey ? `${spectralColors[entry.bandKey]}22` : undefined;

        const cells = compositeIds.map(id => {
            const sensors = devices[id].sensors || [];
            const matchedSensor = sensors.find(s => {
                const sensorType = s?.sensorType || s?.valueType;
                const sensorModel = s?.sensorName || s?.source || '-';
                return sanitize(sensorType) === entry.normalizedType && (sanitize(sensorModel) || entry.normalizedType) === entry.normalizedModel;
            });

            const value = matchedSensor?.value;
            const unit = matchedSensor?.unit || '';
            const display = (value === undefined || value === null)
                ? '-'
                : `${typeof value === 'number' ? value.toFixed(1) : value}${unit ? ` ${unit}` : ''}`;
            const health = devices[id].health || {};
            const sensorKey = matchedSensor?.sensorName?.toLowerCase();
            const ok = sensorKey ? (health[sensorKey] ?? health[matchedSensor?.sensorName]) : false;
            const color = getCellColor(value, range);
            return {display, ok, color};
        });

        return {
            measurementType: entry.measurementType,
            sensorModel: entry.sensorModel,
            range,
            cells,
            rowColor,
        };
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
                    <tr key={`${row.measurementType}-${row.sensorModel}`}>
                        <td className={styles.modelCell}>{row.sensorModel}</td>
                        <td className={styles.sensorCell} style={{backgroundColor: row.rowColor}}>
                            {getMeasurementLabel(row.measurementType, row.sensorModel)}
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
