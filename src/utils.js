export function trimOldEntries(data, now, maxAgeMs = 24 * 60 * 60 * 1000) {
    return data.filter(d => d.timestamp >= now - maxAgeMs);
}

export function filterNoise(data) {
    const temp = data.temperature?.value;
    const hum = data.humidity?.value;
    if (typeof temp !== 'number' || typeof hum !== 'number') return null;
    if (temp < -20 || temp > 60 || hum < 0 || hum > 100) return null;
    return data;
}

function extractUnitValue(sensor) {
    return {
        value: Number(sensor.value),
        unit: sensor.unit || ''
    };
}

function parseColorSpectrum(value) {
    const bands = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'];
    const result = {};
    let i = 0;
    for (const key in value) {
        result[bands[i]] = Number(value[key]);
        i++;
    }
    return result;
}

function normalizeHealth(health = {}) {
    const normalized = {};
    for (const key in health) {
        const base = key.split('-')[0];
        normalized[base] = health[key] === true || health[key] === 'true' || health[key] === 1;
    }
    return normalized;
}

export function normalizeSensorData(data) {
    const result = {
        F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
        F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
        health: {}
    };

    if (Array.isArray(data.sensors)) {
        for (const sensor of data.sensors) {
            const type = sensor.type || sensor.valueType;
            const val = Number(sensor.value);
            switch (type) {
                case 'temperature':
                case 'humidity':
                    result[type] = extractUnitValue(sensor);
                    break;
                case 'light':
                    result.lux = extractUnitValue(sensor);
                    break;
                case 'tds':
                    result.tds = extractUnitValue(sensor);
                    break;
                case 'ec':
                    result.ec = extractUnitValue(sensor);
                    break;
                case 'ph':
                    result.ph = extractUnitValue(sensor);
                    break;
                case 'dissolvedOxygen':
                case 'do':
                    result.do = extractUnitValue(sensor);
                    break;
                case 'colorSpectrum': {
                    Object.assign(result, parseColorSpectrum(sensor.value));
                    break;
                }
                case '415nm':
                    result.F1 = val;
                    break;
                case '445nm':
                    result.F2 = val;
                    break;
                case '480nm':
                    result.F3 = val;
                    break;
                case '515nm':
                    result.F4 = val;
                    break;
                case '555nm':
                    result.F5 = val;
                    break;
                case '590nm':
                    result.F6 = val;
                    break;
                case '630nm':
                    result.F7 = val;
                    break;
                case '680nm':
                    result.F8 = val;
                    break;
                case 'clear':
                    result.clear = val;
                    break;
                case 'nir':
                    result.nir = val;
                    break;
            }
        }
        result.health = normalizeHealth(data.health);
    } else {
        const keys = ['temperature', 'humidity', 'lux', 'tds', 'ec', 'ph', 'dissolvedOxygen', 'do'];
        for (const key of keys) {
            if (key in data) {
                const name = (key === 'dissolvedOxygen' || key === 'do') ? 'do' : key;
                result[name] = {
                    value: Number(data[key]),
                    unit: key === 'temperature' ? '°C' : key === 'humidity' ? '%' :
                        key === 'lux' ? 'lux' : key === 'tds' ? 'ppm' :
                            key === 'ec' ? 'mS/cm' : key === 'do' || key === 'dissolvedOxygen' ? 'mg/L' : ''
                };
            }
        }

        const mapping = {
            ch415: 'F1', ch445: 'F2', ch480: 'F3', ch515: 'F4',
            ch555: 'F5', ch590: 'F6', ch630: 'F7', ch680: 'F8'
        };
        for (const [k, v] of Object.entries(mapping)) {
            if (k in data) result[v] = Number(data[k]);
        }

        result.health = normalizeHealth(data.health);
    }

    return result;
}

export function parseSensorJson(str) {
    try {
        return JSON.parse(str);
        // eslint-disable-next-line no-unused-vars
    } catch (e) {
        const fixed = str.replace(/}\s*{"sensorId":/g, '},{"sensorId":');
        return JSON.parse(fixed);
    }
}

export function transformAggregatedData(data) {
    if (!data || !Array.isArray(data.sensors)) return [];
    const map = {};
    for (const sensor of data.sensors) {
        const sensorType = sensor.type || sensor.valueType;
        const unit = sensor.unit || '';
        for (const entry of sensor.data || []) {
            const ts = Date.parse(entry.timestamp);
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
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
}

