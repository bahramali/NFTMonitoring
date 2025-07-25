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

export function normalizeSensorData(data) {
    const result = {
        temperature: { value: 0, unit: "°C" },
        humidity: { value: 0, unit: "%" },
        lux: { value: 0, unit: "lux" },
        tds: { value: 0, unit: "ppm" },
        ec: { value: 0, unit: "mS/cm" },
        ph: { value: 0, unit: '' },
        F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
        F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
        health: {}
    };

    if (Array.isArray(data.sensors)) {
        for (const sensor of data.sensors) {
            const val = Number(sensor.value);
        switch (sensor.type) {
            case 'temperature':
            case 'humidity':
                result[sensor.type] = {
                        value: val,
                        unit: sensor.unit || ''
                };
                break;
            case 'light':
                result.lux = {
                        value: val,
                        unit: sensor.unit || ''
                };
                break;
            case 'tds':
                result.tds = {
                        value: val,
                        unit: sensor.unit || ''
                };
                break;
            case 'ec':
                result.ec = {
                        value: val,
                        unit: sensor.unit || ''
                };
                break;
            case 'ph':
                result.ph = {
                        value: val,
                        unit: sensor.unit || ''
                };
                break;
            case 'colorSpectrum':
                    const bands = ['F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'];
                let i = 0;
                for (const key in sensor.value) {
                        result[bands[i]] = Number(sensor.value[key]);
                    i++;
                }
                    break;
        }
    }
        result.health = { ...data.health };
    } else {
        if ('temperature' in data)
            result.temperature = { value: Number(data.temperature), unit: '°C' };
        if ('humidity' in data)
            result.humidity = { value: Number(data.humidity), unit: '%' };
        if ('lux' in data)
            result.lux = { value: Number(data.lux), unit: 'lux' };
        if ('tds' in data)
            result.tds = { value: Number(data.tds), unit: 'ppm' };
        if ('ec' in data)
            result.ec = { value: Number(data.ec), unit: 'mS/cm' };
        if ('ph' in data)
            result.ph = { value: Number(data.ph), unit: '' };

        const mapping = {
            ch415: 'F1', ch445: 'F2', ch480: 'F3', ch515: 'F4',
            ch555: 'F5', ch590: 'F6', ch630: 'F7', ch680: 'F8'
        };
        for (const [k, v] of Object.entries(mapping)) {
            if (k in data) result[v] = Number(data[k]);
        }

        if ('health' in data) {
            result.health = {};
            for (const key in data.health) {
                const val = data.health[key];
                result.health[key] = val === true || val === 'true' || val === 1;
            }
        }
    }

    return result;
}

export function parseSensorJson(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        // Attempt to fix missing commas between sensor objects
        const fixed = str.replace(/}\s*{"sensorId":/g, '},{"sensorId":');
        return JSON.parse(fixed);
    }
}

export function transformAggregatedData(data) {
    if (!data || !Array.isArray(data.sensors)) return [];
    const map = {};
    for (const sensor of data.sensors) {
        const type = sensor.type;
        const unit = sensor.unit || '';
        for (const entry of sensor.data || []) {
            const ts = Date.parse(entry.timestamp);
            if (!map[ts]) {
                map[ts] = {
                    timestamp: ts,
                    F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
                    F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
                    temperature: { value: 0, unit: '°C' },
                    humidity: { value: 0, unit: '%' },
                    lux: { value: 0, unit: 'lux' },
                    tds: { value: 0, unit: 'ppm' },
                    ec: { value: 0, unit: 'mS/cm' },
                    ph: { value: 0, unit: '' },
                };
            }
            const out = map[ts];
            const val = entry.value;
            switch (type) {
                case 'temperature':
                case 'humidity':
                    out[type] = { value: Number(val), unit };
                    break;
                case 'light':
                    out.lux = { value: Number(val), unit };
                    break;
                case 'tds':
                    out.tds = { value: Number(val), unit };
                    break;
                case 'ec':
                    out.ec = { value: Number(val), unit };
                    break;
                case 'ph':
                    out.ph = { value: Number(val), unit };
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
            }
        }
    }
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
}

