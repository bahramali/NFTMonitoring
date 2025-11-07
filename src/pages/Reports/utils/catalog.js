const API_BASE = import.meta.env?.VITE_API_BASE ?? "https://api.hydroleaf.se";

export const CATALOG_ENDPOINTS = [
    `${API_BASE}/api/reports/meta`,
    `${API_BASE}/api/device-catalog`,
    `${API_BASE}/api/deviceCatalog`,
];

export const normalizeDeviceCatalog = (raw) => {
    if (!raw) return null;
    if (Array.isArray(raw)) return { devices: raw };
    if (Array.isArray(raw.devices)) return raw;
    if (raw.data) {
        if (Array.isArray(raw.data)) return { ...raw, devices: raw.data };
        if (Array.isArray(raw.data.devices)) return { ...raw, ...raw.data };
    }
    if (raw.catalog) {
        if (Array.isArray(raw.catalog)) return { ...raw, devices: raw.catalog };
        if (Array.isArray(raw.catalog.devices)) return { ...raw, ...raw.catalog };
    }
    return null;
};

export const fetchDeviceCatalog = async ({ signal } = {}) => {
    let lastError = null;
    for (const url of CATALOG_ENDPOINTS) {
        try {
            const res = await fetch(url, { signal });
            if (!res.ok) {
                lastError = new Error(`HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();
            const parsed = normalizeDeviceCatalog(data);
            if (parsed?.devices?.length) {
                return { catalog: parsed, error: null };
            }
        } catch (error) {
            if (error?.name === "AbortError") {
                throw error;
            }
            lastError = error;
        }
    }
    return { catalog: null, error: lastError };
};

export { API_BASE };
