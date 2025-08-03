import React from 'react';
import styles from './DeviceTable.module.css';
import idealRanges from '../idealRangeConfig';
import spectralColors from '../spectralColors';

function getCellColor(value, range) {
    if (!range) return '';
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    if (value < range.min || value > range.max) return '#f8d7da';
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) {
        return '#fff3cd';
    }
    return '';
}

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

const spectralSensorMap = {
    '415nm': 'F1',
    '445nm': 'F2',
    '480nm': 'F3',
    '515nm': 'F4',
    '555nm': 'F5',
    '590nm': 'F6',
    '630nm': 'F7',
    '680nm': 'F8',
    clear: 'clear',
    nir: 'nir'
};

// Map each data field to the sensor name responsible for it so that
// the health indicator can reference the correct status key.
const sensorFieldMap = {
    veml7700: ['lux'],
    sht3x: ['temperature', 'humidity'],
    as7341: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'],
    tds: ['tds', 'ec'],
    ph: ['ph'],
    do: ['do']
};

const fieldToSensor = Object.fromEntries(
    Object.entries(sensorFieldMap).flatMap(([sensor, fields]) =>
        fields.map(f => [f, sensor])
    )
);

const sensorModelMap = {
    temperature: 'SHT3x',
    humidity: 'SHT3x',
    lux: 'VEML7700',
    tds: 'version 1.0',
    ec: 'version 1.0',
    ph: 'E-201',
    do: 'DFROBOT',
};

for (const key of Object.keys(bandMap)) {
    sensorModelMap[key] = 'AS7341';
}
sensorModelMap.clear = 'AS7341';
sensorModelMap.nir = 'AS7341';

function DeviceTable({ devices = {} }) {
    const deviceIds = Object.keys(devices);

    const sample = devices[deviceIds[0]];
    const waterTankMode = Array.isArray(sample?.sensors) && sample.sensors.some(s => 'valueType' in s);

    if (waterTankMode) {
        const sensorInfo = [];
        const seen = new Set();
        for (const s of sample.sensors) {
            const key = s.valueType;
            if (seen.has(key)) continue;
            seen.add(key);
            sensorInfo.push({ sensorName: s.sensorName || s.source || '-', valueType: key });
        }

        const healthKeyMap = { temperature: 'temp', dissolvedOxygen: 'do' };

        const rows = sensorInfo.map(info => {
            const range = idealRanges[info.valueType]?.idealRange;
            const cells = deviceIds.map(id => {
                const sens = devices[id]?.sensors?.find(s => s.valueType === info.valueType);
                const val = sens?.value;
                const unit = sens?.unit || '';
                const display = val === undefined || val === null
                    ? '-'
                    : `${typeof val === 'number' ? val.toFixed(1) : val}${unit ? ` ${unit}` : ''}`;
                const healthKey = healthKeyMap[info.valueType] || info.valueType;
                const ok = devices[id]?.health?.[healthKey] ?? false;
                const color = getCellColor(val, range);
                return { display, ok, color };
            });
            return { info, range, cells };
        });

        return (
            <div className={styles.wrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.modelCell}>Model</th>
                            <th className={styles.sensorCell}>Sensor</th>
                            <th className={styles.modelCell}>Min</th>
                            <th className={styles.modelCell}>Max</th>
                            {deviceIds.map(id => (
                                <th key={id}>{id}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.info.valueType}>
                                <td className={styles.modelCell}>{r.info.sensorName}</td>
                                <td className={styles.sensorCell}>{r.info.valueType}</td>
                                <td>{r.range?.min ?? '-'}</td>
                                <td>{r.range?.max ?? '-'}</td>
                                {r.cells.map((c, i) => (
                                    <td key={deviceIds[i]} style={{ backgroundColor: c.color }}>
                                        <div className={styles.cellWrapper}>
                                            <span className={`${styles.indicator} ${c.ok ? styles.on : styles.off}`}></span>
                                            <span className={styles.cellValue}>{c.display}</span>
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

    const reverseBandMap = Object.fromEntries(
        Object.entries(bandMap).map(([k, v]) => [v, k])
    );

    const sensorSet = new Set();
    const fieldToSensorName = {};
    const knownFields = new Set([
        'temperature','humidity','lux','tds','ec','ph','do',
        'F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'
    ]);
    const metaFields = new Set(['timestamp','deviceId','location']);

    for (const data of Object.values(devices)) {
        if (Array.isArray(data.sensors)) {
            for (const s of data.sensors) {
                const type = s && (s.type || s.valueType);
                if (type) {
                    const display = bandMap[type] || type;
                    sensorSet.add(display);
                    const orig = reverseBandMap[type] || type;
                    const name = s.sensorName || s.source;
                    if (name) fieldToSensorName[orig] = name;
                }
            }
        }
        for (const key of Object.keys(data)) {
            if (key === 'health' || key === 'sensors') continue;
            if (metaFields.has(key)) continue;
            if (Array.isArray(data.sensors) && knownFields.has(key)) continue;
            sensorSet.add(bandMap[key] || key);
        }
    }

    const orderedModels = [
        'SHT3x',
        'VEML7700',
        'version 1.0',
        'E-201',
        'DFROBOT',
        'AS7341',
    ];

    const modelGroups = Object.fromEntries(orderedModels.map(m => [m, []]));

    for (const sensor of sensorSet) {
        const orig = reverseBandMap[sensor] || sensor;
        const model = sensorModelMap[orig] || 'AS7341';
        modelGroups[model].push(sensor);
    }

    const orderedSensors = orderedModels.flatMap(m => modelGroups[m]);

    const rows = orderedSensors.map(sensor => {
        const orig = reverseBandMap[sensor] || sensor;
        const range = idealRanges[sensor]?.idealRange;
        const model = sensorModelMap[orig] || 'AS7341';
        const sensorName = fieldToSensorName[orig] || sensorModelMap[orig] || orig;
        const bandKey = spectralSensorMap[sensor];
        const rowColor = bandKey ? `${spectralColors[bandKey]}22` : undefined;
        const cells = deviceIds.map(id => {
            const valObj = devices[id]?.[orig];
            const value =
                valObj && typeof valObj === 'object' && 'value' in valObj
                    ? valObj.value
                    : valObj;
            const display =
                typeof value === 'number' ? value.toFixed(1) : value;
            const healthKey = fieldToSensor[orig] || orig;
            const ok = devices[id]?.health?.[healthKey] ?? false;
            const color = getCellColor(value, range);
            return { value: display, ok, color };
        });
        return { sensor, range, cells, sensorName, rowColor };
    });

    const sensorDisplayMap = {
        temperature: 'Temp',
        humidity: 'Hum',
        do: 'DO',
    };

    const nameCounts = {};
    for (const r of rows) {
        nameCounts[r.sensorName] = (nameCounts[r.sensorName] || 0) + 1;
    }

    const seenName = {};
    for (const r of rows) {
        if (!seenName[r.sensorName]) {
            r.rowSpan = nameCounts[r.sensorName];
            seenName[r.sensorName] = true;
        } else {
            r.rowSpan = 0;
        }
    }

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={styles.modelCell}>Sensor Name</th>
                        <th className={styles.sensorCell}>Sensor</th>
                        <th className={styles.modelCell}>Min</th>
                        <th className={styles.modelCell}>Max</th>
                        {deviceIds.map(id => (
                            <th key={id}>{id}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.sensor}>
                            {r.rowSpan > 0 && (
                                <td rowSpan={r.rowSpan} className={styles.modelCell}>
                                    {r.sensorName}
                                </td>
                            )}
                            <td
                                className={styles.sensorCell}
                                style={{ backgroundColor: r.rowColor }}
                            >
                                {sensorDisplayMap[r.sensor] || r.sensor}
                            </td>
                            <td style={{ backgroundColor: r.rowColor }}>{r.range?.min ?? '-'}</td>
                            <td style={{ backgroundColor: r.rowColor }}>{r.range?.max ?? '-'}</td>
                            {r.cells.map((c, i) => (
                                <td key={deviceIds[i]} style={{ backgroundColor: c.color }}>
                                    <div className={styles.cellWrapper}>
                                        <span
                                            className={`${styles.indicator} ${c.ok ? styles.on : styles.off}`}
                                        ></span>
                                        <span className={styles.cellValue}>{c.value ?? '-'}</span>
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
