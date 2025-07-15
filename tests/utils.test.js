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

test('defaults missing values to zero and keeps temperature', () => {
    const raw = { temperature: 22.5 };
    const result = normalizeSensorData(raw);
    expect(result.F1).toBe(0);
    expect(result.temperature).toBe(22.5);
});

test('includes health statuses', () => {
    const raw = { health: { veml7700: false, as7341: true } };
    const result = normalizeSensorData(raw);
    expect(result.health.veml7700).toBe(false);
    expect(result.health.as7341).toBe(true);
});

test('filterNoise discards out of range values', () => {
    const clean = {
        F1: 100, F2: 100, F3: 100, F4: 100,
        F5: 100, F6: 100, F7: 100, F8: 100,
        clear: 100, nir: 100, temperature: 20, lux: 50,
    };
    expect(filterNoise(clean)).toEqual(clean);

    const noisy = { ...clean, F1: 20000 };
    expect(filterNoise(noisy)).toBeNull();
});
