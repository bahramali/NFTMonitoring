import { API_BASE } from "./topics";
import { authFetch } from "./http.js";

const STATUS_BASE = `${API_BASE}/api/status`;

function buildStatusUrl(system, layer, sensorType = "all") {
    if (!system || !layer) {
        throw new Error("System and layer are required to load status");
    }

    if (sensorType === "all") {
        return `${STATUS_BASE}/${system}/${layer}/all/average`;
    }

    return `${STATUS_BASE}/${system}/${layer}/${sensorType}/average`;
}

export async function fetchLayerStatus({ system, layer, sensorType = "all", signal } = {}) {
    const url = buildStatusUrl(system, layer, sensorType);
    const response = await authFetch(url, { signal });

    if (!response.ok) {
        throw new Error(`Failed to load layer status (${response.status})`);
    }

    return response.json();
}

export { STATUS_BASE };
