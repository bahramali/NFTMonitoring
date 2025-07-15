export function trimOldEntries(entries, now = Date.now()) {
    const DAY = 24 * 60 * 60 * 1000;
    return entries.filter(e => now - e.timestamp < DAY);
}

export function normalizeSensorData(data = {}) {
    return {
        F1: data.ch415 ?? data.F1 ?? 0,
        F2: data.ch445 ?? data.F2 ?? 0,
        F3: data.ch480 ?? data.F3 ?? 0,
        F4: data.ch515 ?? data.F4 ?? 0,
        F5: data.ch555 ?? data.F5 ?? 0,
        F6: data.ch590 ?? data.F6 ?? 0,
        F7: data.ch630 ?? data.F7 ?? 0,
        F8: data.ch680 ?? data.F8 ?? 0,
        clear: data.clear ?? 0,
        nir: data.nir ?? 0,
        temperature: data.temperature ?? 0,
        lux: data.lux ?? 0,
    };
}
