import { trimOldEntries, normalizeSensorData } from './utils';

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