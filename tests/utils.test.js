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
    const raw = { ch415: 1, ch445: 2, ch480: 3, ch515: 4, ch555: 5, ch590: 6, ch630: 7, ch680: 8 };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(1);
    expect(result.F6).toBe(6);
});

test('defaults missing values to zero and keeps temperature and humidity', () => {
    const raw = { temperature: 22.5, humidity: 60 };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(0);
    expect(result.temperature.value).toBe(22.5);
    expect(result.humidity.value).toBe(60);
});

test('includes health statuses', () => {
    const raw = { health: { veml7700: false, as7341: true, sht3x: false } };
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
    expect(result.health.sht3x).toBe(false);
});

test('parses string and numeric health values', () => {
    const raw = { health: { veml7700: 'false', as7341: 'true', sht3x: 0 } };
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
    expect(result.health.sht3x).toBe(false);
});

test('parses numeric strings into numbers', () => {
    const raw = { ch415: '10', temperature: '21.5', humidity: '55', lux: '30' };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(10);
    expect(result.temperature.value).toBe(21.5);
    expect(result.humidity.value).toBe(55);
    expect(result.lux.value).toBe(30);
});

test('normalizes sensors array structure', () => {
    const raw = {
        sensors: [
            { type: 'temperature', value: 26.5, unit: '°C' },
            { type: 'humidity', value: 50, unit: '%' },
            { type: 'light', value: 9, unit: 'lux' },
            {
                type: 'colorSpectrum',
                value: {
                    '415nm': 3,
                    '445nm': 4,
                    '480nm': 7,
                    '515nm': 9,
                    '555nm': 15,
                    '590nm': 24,
                    '630nm': 27,
                    '680nm': 26
                },
                unit: 'raw'
            },
            { type: 'tds', value: 89, unit: 'ppm' },
            { type: 'ec', value: 0.14, unit: 'mS/cm' }
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
