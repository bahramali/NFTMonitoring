export function sanitize(value) {
    if (value === undefined || value === null) return "";
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const AS7343_MODEL_KEY = "as7343";

export function isAs7343Sensor(sensorName) {
    return sanitize(sensorName) === AS7343_MODEL_KEY;
}

export function makeMeasurementKey(normalizedType, normalizedModel) {
    return `${normalizedType}|${normalizedModel}`;
}
