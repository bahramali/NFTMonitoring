import { normalizeSensors as baseNormalizeSensors, canonKey } from './utils/normalizeSensors.js';

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
        const base = key.split('-')[0].toLowerCase();
        normalized[base] = health[key] === true || health[key] === 'true' || health[key] === 1;
    }
    return normalized;
}

// Flattens sensor array into a single object keyed by sensorType (for charts)
export function normalizeSensorData(data = {}) {
    const result = baseNormalizeSensors(data.sensors || []);
    result.health = normalizeHealth(data.health);
    return result;
}

// expose shared normalizer
export { baseNormalizeSensors as normalizeSensors };

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
        const rawType = sensor.sensorType || sensor.valueType;
        const unit = sensor.unit || '';
        const canonicalKey = typeof rawType === 'string' ? canonKey(rawType) : undefined;
        const normalizedKey =
            typeof rawType === 'string' ? rawType.trim().toLowerCase() : undefined;
        const sensorType =
            typeof canonicalKey === 'string' && canonicalKey
                ? canonicalKey.replace(/\s+/g, '')
                : typeof rawType === 'string'
                    ? rawType.replace(/\s+/g, '')
                    : rawType;
        const aliasKeys = new Set();
        if (typeof canonicalKey === 'string' && canonicalKey) aliasKeys.add(canonicalKey);
        if (typeof normalizedKey === 'string' && normalizedKey) aliasKeys.add(normalizedKey);

        for (const entry of sensor.data || []) {
            const ts = Date.parse(entry.timestamp);

            // Initialize time slot if not present
            if (!map[ts]) {
                map[ts] = {
                    timestamp: ts,
                    F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
                    F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
                    '405nm': 0, '425nm': 0, '450nm': 0, '475nm': 0,
                    '515nm': 0, '550nm': 0, '555nm': 0, '600nm': 0,
                    '640nm': 0, '690nm': 0, '745nm': 0,
                    VIS1: 0, VIS2: 0, NIR855: 0,
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
                case 'lux':
                    out.lux = {value: Number(val), unit};
                    break;
                case 'tds':
                case 'dissolvedTDS':
                    out.tds = { value: Number(val), unit };
                    break;
                case 'ec':
                case 'dissolvedEC':
                    out.ec = { value: Number(val), unit };
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
                case '405nm':
                    out['405nm'] = Number(val);
                    break;
                case '425nm':
                    out['425nm'] = Number(val);
                    break;
                case '450nm':
                    out['450nm'] = Number(val);
                    break;
                case '475nm':
                    out['475nm'] = Number(val);
                    break;
                case '550nm':
                    out['550nm'] = Number(val);
                    break;
                case '600nm':
                    out['600nm'] = Number(val);
                    break;
                case '640nm':
                    out['640nm'] = Number(val);
                    break;
                case '690nm':
                    out['690nm'] = Number(val);
                    break;
                case '745nm':
                    out['745nm'] = Number(val);
                    break;
                case 'VIS1':
                case 'vis1':
                    out.VIS1 = Number(val);
                    break;
                case 'VIS2':
                case 'vis2':
                    out.VIS2 = Number(val);
                    break;
                case 'NIR855':
                case 'nir855':
                    out.NIR855 = Number(val);
                    break;
                case 'clear':
                    out.clear = Number(val);
                    break;
                case 'nir':
                    out.nir = Number(val);
                    break;
            }

            for (const key of aliasKeys) {
                if (!key || key in out) continue;
                if (val && typeof val === 'object' && 'value' in val) {
                    const numeric = Number(val.value);
                    out[key] = {
                        value: Number.isFinite(numeric) ? numeric : null,
                        unit: val.unit ?? unit,
                    };
                } else {
                    const numeric = Number(val);
                    out[key] = {
                        value: Number.isFinite(numeric) ? numeric : null,
                        unit,
                    };
                }
            }
        }
    }

    // Sort by timestamp ascending
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
}

