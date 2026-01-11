import { authFetch } from "../../../api/http.js";

import { getApiBaseUrl } from '../../../config/apiBase.js';

const API_BASE = getApiBaseUrl();

const NAME_KEYS = ["name", "label", "title", "displayName"];
const DEFAULT_OBJECT_KEYS = ["id", "value", "code", "key", "systemId", "layerId", "deviceId"];

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

const splitCompositeId = (cid) => {
    const value = textFromValue(cid);
    if (!value) return { systemId: "", layerId: "", deviceId: "" };
    const parts = value.split("-");
    if (parts.length >= 3) {
        return {
            systemId: parts[0] ?? "",
            layerId: parts[1] ?? "",
            deviceId: parts.slice(2).join("-") ?? "",
        };
    }
    return {
        systemId: parts[0] ?? "",
        layerId: parts[1] ?? "",
        deviceId: parts.slice(2).join("-") || "",
    };
};

const normalizeDeviceEntry = (entry) => {
    if (entry === undefined || entry === null) return null;

    if (typeof entry !== "object" || Array.isArray(entry)) {
        const compositeId = textFromValue(entry);
        if (!compositeId) return null;
        const { systemId, layerId, deviceId } = splitCompositeId(compositeId);
        const resolvedDeviceId = deviceId || compositeId;
        return {
            compositeId,
            systemId,
            layerId,
            deviceId: resolvedDeviceId,
            deviceName: resolvedDeviceId,
        };
    }

    const systemId = pickText([
        entry.systemId,
        entry.systemID,
        entry.systemCode,
        entry.systemKey,
        entry.system,
        entry.system?.id,
        entry.system?.systemId,
        entry.system?.code,
        entry.system?.key,
        entry.systemInfo,
        entry.systemInfo?.id,
    ]);
    const systemName = pickText([
        entry.systemName,
        entry.systemLabel,
        entry.system,
        entry.system?.name,
        entry.system?.label,
        entry.systemInfo,
        entry.systemInfo?.name,
        entry.systemInfo?.label,
    ], NAME_KEYS);

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

    const compositeIdRaw = pickText([
        entry.compositeId,
        entry.compositeID,
        entry.cid,
        entry.deviceCompositeId,
        entry.deviceCompositeID,
        entry.id && systemId && layerId ? `${systemId}-${layerId}-${textFromValue(entry.id)}` : "",
    ]);

    const fallbackComposite = [systemId, layerId, deviceId].filter(Boolean).join("-");
    const compositeId = compositeIdRaw || fallbackComposite;
    if (!compositeId) return null;

    const fromComposite = splitCompositeId(compositeId);
    const resolvedSystemId = systemId || fromComposite.systemId;
    const resolvedLayerId = layerId || fromComposite.layerId;
    const resolvedDeviceId = deviceId || fromComposite.deviceId || compositeId;
    const resolvedSystemName = systemName || fromComposite.systemId || resolvedSystemId;
    const resolvedLayerName = layerName || fromComposite.layerId || resolvedLayerId;
    const resolvedDeviceName = deviceName || resolvedDeviceId;

    return {
        ...entry,
        systemId: resolvedSystemId,
        systemName: resolvedSystemName,
        layerId: resolvedLayerId,
        layerName: resolvedLayerName,
        deviceId: resolvedDeviceId,
        deviceName: resolvedDeviceName,
        compositeId,
    };
};

const ingestDeviceArray = (targetMap, values = []) => {
    if (!Array.isArray(values)) return;
    values.forEach((value) => {
        const normalized = normalizeDeviceEntry(value);
        if (!normalized?.compositeId) return;
        const existing = targetMap.get(normalized.compositeId) || {};
        targetMap.set(normalized.compositeId, { ...existing, ...normalized });
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
                    systemId: systemId || device.systemId,
                    systemName: systemName || device.systemName,
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
