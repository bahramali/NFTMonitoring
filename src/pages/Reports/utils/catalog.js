import { authFetch } from "../../../api/http.js";
import { buildDeviceKey } from "../../../utils/deviceIdentity.js";

import { getApiBaseUrl } from '../../../config/apiBase.js';

const API_BASE = getApiBaseUrl();

const NAME_KEYS = ["name", "label", "title", "displayName"];
const DEFAULT_OBJECT_KEYS = ["id", "value", "code", "key", "farmId", "unitType", "unitId", "layerId", "deviceId"];

const textFromValue = (value, preferredKeys = []) => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return "";
    if (typeof value === "object") {
        const keysToCheck = [...preferredKeys, ...DEFAULT_OBJECT_KEYS, ...NAME_KEYS];
        for (const key of keysToCheck) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const text = textFromValue(value[key], preferredKeys);
                if (text) return text;
            }
        }
        return "";
    }
    return "";
};

const pickText = (values, preferredKeys = []) => {
    for (const value of values) {
        const text = textFromValue(value, preferredKeys);
        if (text) return text;
    }
    return "";
};

const normalizeDeviceEntry = (entry) => {
    if (entry === undefined || entry === null) return null;

    if (typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }

    const farmId = pickText([
        entry.farmId,
        entry.farm_id,
        entry.farm,
        entry.systemId,
        entry.systemID,
        entry.system,
        entry.siteId,
        entry.site,
        entry.farm?.id,
        entry.system?.id,
        entry.site?.id,
    ]);
    const farmName = pickText([
        entry.farmName,
        entry.farmLabel,
        entry.farm?.name,
        entry.systemName,
        entry.systemLabel,
        entry.system?.name,
        entry.siteName,
        entry.site?.name,
    ], NAME_KEYS);

    const unitType = pickText([
        entry.unitType,
        entry.unit_type,
        entry.unit,
        entry.type,
        entry.unitTypeName,
    ]);
    const unitId = pickText([
        entry.unitId,
        entry.unit_id,
        entry.unitKey,
        entry.unit,
        entry.rackId,
        entry.rack,
    ]);

    const layerId = pickText([
        entry.layerId,
        entry.layerID,
        entry.layerCode,
        entry.layerKey,
        entry.layer,
        entry.layer?.id,
        entry.layer?.layerId,
        entry.layer?.code,
        entry.layer?.key,
    ]);
    const layerName = pickText([
        entry.layerName,
        entry.layerLabel,
        entry.layer,
        entry.layer?.name,
        entry.layer?.label,
    ], NAME_KEYS);

    const deviceId = pickText([
        entry.deviceId,
        entry.deviceID,
        entry.deviceCode,
        entry.deviceKey,
        entry.device,
        entry.device?.id,
        entry.device?.deviceId,
        entry.device?.code,
        entry.device?.key,
        entry.id,
    ]);
    const deviceName = pickText([
        entry.deviceName,
        entry.deviceLabel,
        entry.name,
        entry.label,
        entry.device,
        entry.device?.name,
        entry.device?.label,
    ], NAME_KEYS);

    if (!farmId || !unitType || !unitId || !deviceId) return null;

    return {
        ...entry,
        farmId,
        farmName: farmName || farmId,
        unitType,
        unitId,
        layerId,
        layerName: layerName || layerId,
        deviceId,
        deviceName: deviceName || deviceId,
    };
};

const ingestDeviceArray = (targetMap, values = []) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => {
        const normalized = normalizeDeviceEntry(value);
        if (!normalized) return;
        const key = buildDeviceKey(normalized);
        if (!key) return;
        const existing = targetMap.get(key) || {};
        targetMap.set(key, { ...existing, ...normalized, deviceKey: key });
    });
};

const ingestSystemArray = (targetMap, systems = []) => {
    if (!Array.isArray(systems)) return;
    systems.forEach((system) => {
        const systemId = pickText([
            system.systemId,
            system.id,
            system.system,
            system.code,
            system.key,
        ]);
        const systemName = pickText([
            system.systemName,
            system.name,
            system.label,
        ], NAME_KEYS);
        const layers = Array.isArray(system.layers) ? system.layers : [];
        layers.forEach((layer) => {
            const layerId = pickText([
                layer.layerId,
                layer.id,
                layer.layer,
                layer.code,
                layer.key,
            ]);
            const layerName = pickText([
                layer.layerName,
                layer.name,
                layer.label,
            ], NAME_KEYS);
            const devices = Array.isArray(layer.devices) ? layer.devices : [];
            devices.forEach((device) => {
                ingestDeviceArray(targetMap, [{
                    farmId: systemId || device.farmId,
                    farmName: systemName || device.farmName,
                    layerId: layerId || device.layerId,
                    layerName: layerName || device.layerName,
                    ...device,
                }]);
            });
        });
    });
};

export const normalizeDeviceCatalog = (raw) => {
    if (!raw) return null;

    const deviceMap = new Map();

    ingestDeviceArray(deviceMap, raw);
    ingestDeviceArray(deviceMap, raw?.devices);
    ingestDeviceArray(deviceMap, raw?.data);
    ingestDeviceArray(deviceMap, raw?.data?.devices);
    ingestDeviceArray(deviceMap, raw?.catalog);
    ingestDeviceArray(deviceMap, raw?.catalog?.devices);

    ingestSystemArray(deviceMap, raw?.systems);
    ingestSystemArray(deviceMap, raw?.data?.systems);
    ingestSystemArray(deviceMap, raw?.catalog?.systems);

    const devices = Array.from(deviceMap.values());
    if (!devices.length) return null;
    return { devices };
};

export const CATALOG_ENDPOINTS = [
    `${API_BASE}/api/devices`,
    `${API_BASE}/api/devices/all`,
    `${API_BASE}/api/reports/meta`,
    `${API_BASE}/api/device-catalog`,
    `${API_BASE}/api/deviceCatalog`,
];

export const fetchDeviceCatalog = async ({ signal } = {}) => {
    let lastError = null;
    for (const url of CATALOG_ENDPOINTS) {
        try {
            const res = await authFetch(url, { signal });
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
