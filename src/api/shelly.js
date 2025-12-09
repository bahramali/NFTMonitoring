import { API_BASE } from "./topics";

const SHELLY_BASE = `${API_BASE}/api/shelly`;

async function handleResponse(response, defaultErrorMessage) {
    if (!response.ok) {
        let message = `${defaultErrorMessage} (${response.status})`;
        try {
            const body = await response.json();
            if (body?.message) message = body.message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function fetchShellyDevices({ signal } = {}) {
    const response = await fetch(`${SHELLY_BASE}/devices`, { signal });
    return handleResponse(response, "Failed to load Shelly devices");
}

export async function fetchShellyDeviceStatus(deviceId, { signal } = {}) {
    const response = await fetch(`${SHELLY_BASE}/devices/${deviceId}/status`, { signal });
    return handleResponse(response, `Failed to load status for ${deviceId}`);
}

export async function turnShellyOn(deviceId) {
    const response = await fetch(`${SHELLY_BASE}/devices/${deviceId}/on`, { method: "POST" });
    return handleResponse(response, `Failed to turn on ${deviceId}`);
}

export async function turnShellyOff(deviceId) {
    const response = await fetch(`${SHELLY_BASE}/devices/${deviceId}/off`, { method: "POST" });
    return handleResponse(response, `Failed to turn off ${deviceId}`);
}

export async function toggleShellyDevice(deviceId) {
    const response = await fetch(`${SHELLY_BASE}/devices/${deviceId}/toggle`, { method: "POST" });
    return handleResponse(response, `Failed to toggle ${deviceId}`);
}

export async function scheduleShellyDevice(deviceId, payload) {
    const response = await fetch(`${SHELLY_BASE}/devices/${deviceId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
    });

    return handleResponse(response, `Failed to schedule ${deviceId}`);
}

export { SHELLY_BASE };
