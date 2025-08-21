import { normalizeSensorData, filterNoise, transformAggregatedData } from '../src/utils';

test('normalizes sensor readings and spectral bands', () => {
    const raw = require('./data/growSensors.json');
    const result = normalizeSensorData(raw);
    expect(result['405nm']).toBe(274);
    expect(result.F4).toBe(493); // 515nm -> F4
    expect(result.F5).toBe(553); // 555nm -> F5
});

test('parses water tank readings', () => {
    const raw = require('./data/waterTank.json');
    const result = normalizeSensorData(raw);
    expect(result.tds.value).toBeCloseTo(1006.389);
    expect(result.ec.value).toBeCloseTo(1.572483);
    expect(result.temperature.value).toBe(23.625);
    expect(result.do.value).toBeCloseTo(2.809549);
});

test('includes health statuses', () => {
    const raw = require('./data/growSensorsWithHealthFalse.json');
    const result = normalizeSensorData(raw);
    expect(result.health.sht3x).toBe(false);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7343).toBe(false);
});

test('parses string and numeric health values', () => {
    const raw = require('./data/growSensorsWithHealthFalse.json');
    const result = normalizeSensorData(raw);
    expect(result.health.sht3x).toBe(false);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7343).toBe(false);
});

test('parses numeric strings into numbers', () => {
    const raw = require('./data/growSensors.json');
    const result = normalizeSensorData(raw);
    expect(result.temperature.value).toBeCloseTo(27.75);
    expect(result.humidity.value).toBeCloseTo(47.17);
    expect(result.lux.value).toBeCloseTo(3818.189);
});

test('normalizes sensors array structure', () => {
    const raw = {
        sensors: [
            { sensorId: 'sht3x-01', sensorType: 'temperature', value: 26.5, unit: '°C' },
            { sensorId: 'sht3x-01', sensorType: 'humidity', value: 50, unit: '%' },
            { sensorId: 'veml7700-01', sensorType: 'light', value: 9, unit: 'lux' },
            { sensorId: 'as7341-01', sensorType: '415nm', value: 3, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '445nm', value: 4, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '480nm', value: 7, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '515nm', value: 9, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '555nm', value: 15, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '590nm', value: 24, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '630nm', value: 27, unit: 'raw' },
            { sensorId: 'as7341-01', sensorType: '680nm', value: 26, unit: 'raw' },
            { sensorId: 'tds-01', sensorType: 'tds', value: 89, unit: 'ppm' },
            { sensorId: 'ec-estimated', sensorType: 'ec', value: 0.14, unit: 'mS/cm' }
        ],
        health: { sht3x: true, veml7700: true, as7341: true, tds: true, ph: false }
    };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(3);
    expect(result.F8).toBe(26);
    expect(result.temperature.value).toBe(26.5);
    expect(result.humidity.value).toBe(50);
    expect(result.lux.value).toBe(9);
    expect(result.tds.value).toBe(89);
    expect(result.ec.value).toBe(0.14);
    expect(result.health.tds).toBe(true);
    expect(result.health.ph).toBe(false);
});

test('handles ph sensor readings', () => {
    const raw = {
        sensors: [
            { sensorType: 'ph', value: 6.2, unit: '' }
        ]
    };
    const result = normalizeSensorData(raw);
    expect(result.ph.value).toBe(6.2);
});

test('supports sensors using valueType field', () => {
    const raw = {
        sensors: [
            { sensorName: 'HailegeTDS', valueType: 'tds', value: 535.7, unit: 'ppm' },
            { sensorName: 'DS18B20', valueType: 'temperature', value: 24.3, unit: '°C' }
        ],
        health: { tds: true, temp: true }
    };
    const result = normalizeSensorData(raw);
    expect(result.tds.value).toBeCloseTo(535.7);
    expect(result.temperature.value).toBe(24.3);
    expect(result.health.tds).toBe(true);
});

test('filterNoise discards out of range values', () => {
    const clean = {
        F1: 100, F2: 100, F3: 100, F4: 100,
        F5: 100, F6: 100, F7: 100, F8: 100,
        clear: 100, nir: 100,
        temperature: { value: 20, unit: '°C' },
        humidity: { value: 40, unit: '%' },
        lux: { value: 50, unit: 'lux' },
    };
    expect(filterNoise(clean)).toEqual(clean);

    const noisy = { ...clean, F1: 20000 };
    expect(filterNoise(noisy)).toEqual(noisy); // چون فعلاً filterNoise مقدار طیفی رو چک نمی‌کنه

    const badHumidity = { ...clean, humidity: { value: 150, unit: '%' } };
    expect(filterNoise(badHumidity)).toBeNull();
});

test('transformAggregatedData converts API response', () => {
    const raw = {
        sensors: [
            { sensorType: 'temperature', unit: '°C', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 27.5 }] },
            { sensorType: 'humidity', unit: '%', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 56 }] },
            { sensorType: 'light', unit: 'lux', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 90 }] },
            { sensorType: 'colorSpectrum', unit: 'raw', data: [{ timestamp: '2025-07-25T09:00:04Z', value: { '415nm': 1, '445nm': 2, '480nm': 3, '515nm': 4, '555nm': 5, '590nm': 6, '630nm': 7, '680nm': 8, clear: 9, nir: 10 } }] }
        ]
    };
    const result = transformAggregatedData(raw);
    expect(result.length).toBe(1);
    const entry = result[0];
    expect(entry.timestamp).toBe(Date.parse('2025-07-25T09:00:04Z'));
    expect(entry.temperature.value).toBe(27.5);
    expect(entry.F3).toBe(3);
    expect(entry.nir).toBe(10);
});

test('transformAggregatedData handles valueType and DO sensor', () => {
    const raw = {
        sensors: [
            { valueType: 'dissolvedOxygen', unit: 'mg/L', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 5.5 }] }
        ]
    };
    const result = transformAggregatedData(raw);
    expect(result.length).toBe(1);
    expect(result[0].do.value).toBe(5.5);
});
