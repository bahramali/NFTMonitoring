import { buildDeviceKey, normalizeIdValue, normalizeUnitType } from "../../utils/deviceIdentity.js";

export function normalizeRackId(rackId) {
    if (rackId === null || rackId === undefined) return "";
    return String(rackId).trim().toLowerCase();
}

export function deviceMatchesRack(device, rackId) {
    const normalizedRackId = normalizeRackId(rackId);
    if (!normalizedRackId) return false;

    const unitType = normalizeUnitType(device?.unitType);
    const unitId = normalizeRackId(device?.unitId);
    if (unitType !== "rack") return false;
    return unitId === normalizedRackId;
}

export function resolveDeviceSelectionKey(device) {
    const key = buildDeviceKey(device);
    if (key) return key;
    const candidates = [device?.deviceId, device?.id, device?.serial];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = normalizeIdValue(candidate);
        if (value) return value;
    }
    return "";
}
