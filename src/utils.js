// Removes old entries older than maxAgeMs from the dataset
export function trimOldEntries(data, now, maxAgeMs = 24 * 60 * 60 * 1000) {
    return data.filter(d => d.timestamp >= now - maxAgeMs);
}

// Filters out obviously invalid temperature/humidity readings
export function filterNoise(data) {
    const temp = data.temperature?.value;
    const hum = data.humidity?.value;
    if (typeof temp !== 'number' || typeof hum !== 'number') return null;
    if (temp < -20 || temp > 60 || hum < 0 || hum > 100) return null;
    return data;
}

// Normalizes health object into a simpler {sensorName: boolean} map
function normalizeHealth(health = {}) {
    const normalized = {};
    for (const key in health) {
        const base = key.split('-')[0];
        normalized[base] = health[key] === true || health[key] === 'true' || health[key] === 1;
    }
    return normalized;
}

// Flattens sensor array into a single object keyed by valueType (for charts)
export function normalizeSensorData(data) {
    const result = {health: {}};

    if (Array.isArray(data.sensors)) {
        for (const sensor of data.sensors) {
            const type = sensor.type || sensor.valueType;
            const val = Number(sensor.value);

            switch (type) {
                case 'temperature':
                case 'humidity':
                    result[type] = {value: val, unit: sensor.unit || ''};
                    break;
                case 'light':
                    result.lux = {value: val, unit: sensor.unit || ''};
                    break;
                case 'tds':
                    result.tds = {value: val, unit: sensor.unit || ''};
                    break;
                case 'ec':
                    result.ec = {value: val, unit: sensor.unit || ''};
                    break;
                case 'ph':
                    result.ph = {value: val, unit: sensor.unit || ''};
                    break;
                case 'dissolvedOxygen':
                case 'do':
                    result.do = {value: val, unit: sensor.unit || ''};
                    break;
                case 'colorSpectrum': {
                    // Map color spectrum object to F1..F8, clear, nir
                    const bands = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'];
                    let i = 0;
                    for (const key in sensor.value) {
                        result[bands[i++]] = Number(sensor.value[key]);
                    }
                    break;
                }

                default: {
                    // Map nm wavelengths or clear/nir
                    const nmMatch = type?.match(/^(\d{3})nm$/);
                    if (nmMatch) {
                        const nmMap = {
                            '415': 'F1', '445': 'F2', '480': 'F3', '515': 'F4',
                            '555': 'F5', '590': 'F6', '630': 'F7', '680': 'F8',
                        };
                        const band = nmMap[nmMatch[1]];
                        if (band) result[band] = val;
                    } else if (type === 'clear' || type === 'nir') {
                        result[type] = val;
                    }
                    break;
                }
            }
        }

        result.health = normalizeHealth(data.health);
    }

    return result;
}

// Parses JSON string, fixes concatenated objects without commas
export function parseSensorJson(str) {
    try {
        return JSON.parse(str);
    } catch {
        const fixed = str.replace(/}\s*{"sensorId":/g, '},{"sensorId":');
        return JSON.parse(fixed);
    }
}

// Transforms aggregated history API output into time-indexed array
export function transformAggregatedData(data) {
    if (!data || !Array.isArray(data.sensors)) return [];
    const map = {};
    for (const sensor of data.sensors) {
        const sensorType = sensor.type || sensor.valueType;
        const unit = sensor.unit || '';

        for (const entry of sensor.data || []) {
            const ts = Date.parse(entry.timestamp);

            // Initialize time slot if not present
            if (!map[ts]) {
                map[ts] = {
                    timestamp: ts,
                    F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
                    F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
                    temperature: {value: 0, unit: '°C'},
                    humidity: {value: 0, unit: '%'},
                    lux: {value: 0, unit: 'lux'},
                    tds: {value: 0, unit: 'ppm'},
                    ec: {value: 0, unit: 'mS/cm'},
                    ph: {value: 0, unit: ''},
                    do: {value: 0, unit: 'mg/L'},
                };
            }
            const out = map[ts];
            const val = entry.value;

            switch (sensorType) {
                case 'temperature':
                case 'humidity':
                    out[sensorType] = {value: Number(val), unit};
                    break;
                case 'light':
                    out.lux = {value: Number(val), unit};
                    break;
                case 'tds':
                    out.tds = {value: Number(val), unit};
                    break;
                case 'ec':
                    out.ec = {value: Number(val), unit};
                    break;
                case 'ph':
                    out.ph = {value: Number(val), unit};
                    break;
                case 'dissolvedOxygen':
                case 'do':
                    out.do = {value: Number(val), unit};
                    break;
                case 'colorSpectrum':
                    if (val && typeof val === 'object') {
                        out.F1 = Number(val['415nm']) || 0;
                        out.F2 = Number(val['445nm']) || 0;
                        out.F3 = Number(val['480nm']) || 0;
                        out.F4 = Number(val['515nm']) || 0;
                        out.F5 = Number(val['555nm']) || 0;
                        out.F6 = Number(val['590nm']) || 0;
                        out.F7 = Number(val['630nm']) || 0;
                        out.F8 = Number(val['680nm']) || 0;
                        out.clear = Number(val['clear']) || 0;
                        out.nir = Number(val['nir']) || 0;
                    }
                    break;
                case '415nm':
                    out.F1 = Number(val);
                    break;
                case '445nm':
                    out.F2 = Number(val);
                    break;
                case '480nm':
                    out.F3 = Number(val);
                    break;
                case '515nm':
                    out.F4 = Number(val);
                    break;
                case '555nm':
                    out.F5 = Number(val);
                    break;
                case '590nm':
                    out.F6 = Number(val);
                    break;
                case '630nm':
                    out.F7 = Number(val);
                    break;
                case '680nm':
                    out.F8 = Number(val);
                    break;
                case 'clear':
                    out.clear = Number(val);
                    break;
                case 'nir':
                    out.nir = Number(val);
                    break;
            }
        }
    }

    // Sort by timestamp ascending
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
}

