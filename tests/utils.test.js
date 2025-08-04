import { trimOldEntries, normalizeSensorData, filterNoise, parseSensorJson, transformAggregatedData } from '../src/utils';

function fixedNow(ms) {
    return 1721310000000; // زمان ثابت برای تست، برای جلوگیری از اختلاف میلی‌ثانیه‌ای
}

test('removes entries older than 24h', () => {
    const now = fixedNow();
    const entries = [
        { timestamp: now - 1000 },
        { timestamp: now - 25 * 60 * 60 * 1000 }
    ];
    const result = trimOldEntries(entries, now, 24 * 60 * 60 * 1000);
    expect(result.length).toBe(1);
});

test('honors custom maxAge', () => {
    const now = fixedNow();
    const entries = [
        { timestamp: now - 5 },
        { timestamp: now - 40 }
    ];
    const result = trimOldEntries(entries, now, 20);
    expect(result.length).toBe(1);
});

test('normalizes ch-prefixed keys to F1-F8', () => {
    const raw = require('./data/growTemp.json');
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(1);
    expect(result.F6).toBe(6);
});

test('keeps temperature and humidity only', () => {
    const raw = require('./data/tankTemp.json');
    const result = normalizeSensorData(raw);
    expect(result.F1).toBeUndefined();
    expect(result.tds.value).toBe(1);
    expect(result.temperature.value).toBe(2);
});

test('includes health statuses', () => {
    const raw = require('./data/growTempWithHealthFalse.json');
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
    expect(result.health.sht3x).toBe(false);
});

test('parses string and numeric health values', () => {
    const raw = require('./data/growTempWithHealthFalse.json');
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
    expect(result.health.sht3x).toBe(false);
});

test('parses numeric strings into numbers', () => {
    const raw = require('./data/growTemp.json');
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(1);
    expect(result.temperature.value).toBe(1);
    expect(result.humidity.value).toBe(2);
    expect(result.lux.value).toBe(100);
});

test('normalizes sensors array structure', () => {
    const raw = {
        sensors: [
            { sensorId: 'sht3x-01', type: 'temperature', value: 26.5, unit: '°C' },
            { sensorId: 'sht3x-01', type: 'humidity', value: 50, unit: '%' },
            { sensorId: 'veml7700-01', type: 'light', value: 9, unit: 'lux' },
            { sensorId: 'as7341-01', type: '415nm', value: 3, unit: 'raw' },
            { sensorId: 'as7341-01', type: '445nm', value: 4, unit: 'raw' },
            { sensorId: 'as7341-01', type: '480nm', value: 7, unit: 'raw' },
            { sensorId: 'as7341-01', type: '515nm', value: 9, unit: 'raw' },
            { sensorId: 'as7341-01', type: '555nm', value: 15, unit: 'raw' },
            { sensorId: 'as7341-01', type: '590nm', value: 24, unit: 'raw' },
            { sensorId: 'as7341-01', type: '630nm', value: 27, unit: 'raw' },
            { sensorId: 'as7341-01', type: '680nm', value: 26, unit: 'raw' },
            { sensorId: 'tds-01', type: 'tds', value: 89, unit: 'ppm' },
            { sensorId: 'ec-estimated', type: 'ec', value: 0.14, unit: 'mS/cm' }
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
            { type: 'ph', value: 6.2, unit: '' }
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

test('parseSensorJson fixes missing commas between sensor objects', () => {
    const malformed = '{"sensors":[{"sensorId":"a","type":"temperature","value":1}{"sensorId":"b","type":"humidity","value":2}]}';
    const parsed = parseSensorJson(malformed);
    expect(Array.isArray(parsed.sensors)).toBe(true);
    expect(parsed.sensors.length).toBe(2);
    expect(parsed.sensors[1].sensorId).toBe('b');
});

test('transformAggregatedData converts API response', () => {
    const raw = {
        sensors: [
            { type: 'temperature', unit: '°C', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 27.5 }] },
            { type: 'humidity', unit: '%', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 56 }] },
            { type: 'light', unit: 'lux', data: [{ timestamp: '2025-07-25T09:00:04Z', value: 90 }] },
            { type: 'colorSpectrum', unit: 'raw', data: [{ timestamp: '2025-07-25T09:00:04Z', value: { '415nm': 1, '445nm': 2, '480nm': 3, '515nm': 4, '555nm': 5, '590nm': 6, '630nm': 7, '680nm': 8, clear: 9, nir: 10 } }] }
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
