export function trimOldEntries(entries, now = Date.now(), maxAge = 24 * 60 * 60 * 1000) {
    return entries.filter(e => now - e.timestamp < maxAge);
}

function toNumber(value, fallback = 0) {
    if (value === undefined || value === null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = true) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
    }
    return Boolean(value);
}

export function normalizeSensorData(data = {}) {
    return {
        F1: toNumber(data.ch415 ?? data.F1, 0),
        F2: toNumber(data.ch445 ?? data.F2, 0),
        F3: toNumber(data.ch480 ?? data.F3, 0),
        F4: toNumber(data.ch515 ?? data.F4, 0),
        F5: toNumber(data.ch555 ?? data.F5, 0),
        F6: toNumber(data.ch590 ?? data.F6, 0),
        F7: toNumber(data.ch630 ?? data.F7, 0),
        F8: toNumber(data.ch680 ?? data.F8, 0),
        clear: toNumber(data.clear, 0),
        nir: toNumber(data.nir, 0),
        temperature: toNumber(data.temperature, 0),
        humidity: toNumber(data.humidity, 0),
        lux: toNumber(data.lux, 0),
        health: {
            veml7700: toBool(data.health?.veml7700, true),
            as7341: toBool(data.health?.as7341, true),
            sht3x: toBool(data.health?.sht3x, true),
        },
    };
}

export function filterNoise(reading, opts = {}) {
    const {
        bandMin = 0,
        bandMax = 10000,
        tempMin = -50,
        tempMax = 60,
        humidityMin = 0,
        humidityMax = 100,
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
    if (reading.humidity < humidityMin || reading.humidity > humidityMax) {
        return null;
    }
    if (reading.lux < luxMin || reading.lux > luxMax) {
        return null;
    }
    return reading;
}
