// Base URL for REST API requests. Falls back to the public API if the
// environment variable is not provided.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.hydroleaf.se';
const BASE_URL = `${API_BASE}/api/sensor-config`;

export async function getSensorConfigs() {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error('Failed to fetch sensor configs');
    return res.json();
}

export async function getSensorConfig(sensorType) {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(sensorType)}`);
    if (!res.ok) throw new Error('Failed to fetch sensor config');
    return res.json();
}

export async function createSensorConfig(data) {
    const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create sensor config');
    return res.json();
}

export async function updateSensorConfig(sensorType, data) {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(sensorType)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update sensor config');
    return res.json();
}

export async function deleteSensorConfig(sensorType) {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(sensorType)}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete sensor config');
    return res.json().catch(() => undefined);
}
