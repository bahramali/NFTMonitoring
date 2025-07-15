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
        health: {
            veml7700: data.health?.veml7700 ?? true,
            as7341: data.health?.as7341 ?? true,
            ds18b20: data.health?.ds18b20 ?? true,
        },
    };
}

export function filterNoise(reading, opts = {}) {
    const {
        bandMin = 0,
        bandMax = 10000,
        tempMin = -50,
        tempMax = 60,
        luxMin = 0,
        luxMax = 100000,
    } = opts;
    const bands = ['F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'];
    for (const key of bands) {
        const val = reading[key];
        if (val < bandMin || val > bandMax) {
            return null;
        }
    }
    if (reading.temperature < tempMin || reading.temperature > tempMax) {
        return null;
    }
    if (reading.lux < luxMin || reading.lux > luxMax) {
        return null;
    }
    return reading;
}
