export function toLocalInputValue(date) {
    const pad = (value) => `${value}`.padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseLocalInput(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

export function getPresetRange(preset) {
    const now = new Date();
    switch (preset) {
        case "1h":
            return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
        case "6h":
            return { from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now };
        case "24h":
            return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now };
        default:
            return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
    }
}

export function getEntryValue(entry, metricKey) {
    if (!metricKey) return null;
    const normalized = metricKey.toLowerCase();
    const valueFromMap = {
        temperature: entry.temperature?.value,
        humidity: entry.humidity?.value,
        light: entry.lux?.value ?? entry.light?.value,
        lux: entry.lux?.value ?? entry.light?.value,
        tds: entry.tds?.value,
        dissolvedtds: entry.tds?.value,
        ec: entry.ec?.value,
        dissolvedec: entry.ec?.value,
        ph: entry.ph?.value,
        do: entry.do?.value,
        dissolvedoxygen: entry.do?.value,
    };

    if (normalized in valueFromMap && valueFromMap[normalized] !== undefined) {
        const mapped = valueFromMap[normalized];
        return mapped === null || Number.isNaN(Number(mapped)) ? null : Number(mapped);
    }

    const directValue = entry[metricKey] ?? entry[normalized];
    if (typeof directValue === "number") {
        return Number.isNaN(directValue) ? null : directValue;
    }
    if (directValue && typeof directValue === "object" && "value" in directValue) {
        const numeric = Number(directValue.value);
        return Number.isNaN(numeric) ? null : numeric;
    }

    return null;
}

export function formatRangeValue(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    const abs = Math.abs(value);
    let decimals = 0;
    if (abs >= 100 || Number.isInteger(value)) {
        decimals = 0;
    } else if (abs >= 10) {
        decimals = 1;
    } else if (abs >= 1) {
        decimals = 1;
    } else if (abs >= 0.1) {
        decimals = 2;
    } else {
        decimals = 3;
    }
    return Number(value.toFixed(decimals)).toString();
}
