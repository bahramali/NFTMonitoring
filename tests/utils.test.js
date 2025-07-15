import { trimOldEntries, normalizeSensorData, filterNoise } from '../src/utils';

test('removes entries older than 24h', () => {
    const now = Date.now();
    const entries = [
        { timestamp: now - 1000 },
        { timestamp: now - 25 * 60 * 60 * 1000 }
    ];
    const result = trimOldEntries(entries, now);
    expect(result.length).toBe(1);
});

test('normalizes ch-prefixed keys to F1-F8', () => {
    const raw = { ch415: 1, ch445: 2, ch480: 3, ch515: 4, ch555: 5, ch590: 6, ch630: 7, ch680: 8 };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(1);
    expect(result.F6).toBe(6);
});

test('defaults missing values to zero and keeps temperature and humidity', () => {
    const raw = { temperature: 22.5, humidity: 50 };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(0);
    expect(result.temperature).toBe(22.5);
    expect(result.humidity).toBe(50);
});

test('includes health statuses', () => {
    const raw = { health: { veml7700: false, as7341: true, sht3x: false } };
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
    expect(result.health.sht3x).toBe(false);
});

test('parses numeric strings into numbers', () => {
    const raw = { ch415: '10', temperature: '21.5', humidity: '55', lux: '30' };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(10);
    expect(result.temperature).toBe(21.5);
    expect(result.humidity).toBe(55);
    expect(result.lux).toBe(30);
});

test('filterNoise discards out of range values', () => {
    const clean = {
        F1: 100, F2: 100, F3: 100, F4: 100,
        F5: 100, F6: 100, F7: 100, F8: 100,
        clear: 100, nir: 100, temperature: 20, humidity: 40, lux: 50,
    };
    expect(filterNoise(clean)).toEqual(clean);

    const noisy = { ...clean, F1: 20000 };
    expect(filterNoise(noisy)).toBeNull();

    const badHumidity = { ...clean, humidity: 150 };
    expect(filterNoise(badHumidity)).toBeNull();
});
