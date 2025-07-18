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

