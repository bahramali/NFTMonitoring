export function normalizeRackId(rackId) {
    if (rackId === null || rackId === undefined) return "";
    return String(rackId).trim().toLowerCase();
}

function splitSegments(value) {
    if (!value) return [];
    return String(value)
        .toLowerCase()
        .split(/[\/\-]+/)
        .filter(Boolean);
}

function normalizeValue(value) {
    if (!value) return "";
    return String(value).trim().toLowerCase();
}

export function parseRackKey(rackId) {
    const normalized = normalizeRackId(rackId);
    if (!normalized) return { siteId: "", rackId: "" };
    const parts = splitSegments(normalized);
    if (parts.length >= 2) {
        return { siteId: parts[0], rackId: parts.slice(1).join("-") };
    }
    return { siteId: "", rackId: normalized };
}

export function deviceMatchesRack(device, rackId) {
    const { siteId: targetSiteId, rackId: targetRackId } = parseRackKey(rackId);
    if (!targetRackId) return false;

    const rawRack =
        device?.rackId ||
        device?.rack ||
        device?.rack_id ||
        device?.meta?.rackId ||
        device?.meta?.rack ||
        device?.extra?.rackId ||
        device?.extra?.rack_id ||
        "";
    const { siteId: rackSiteId, rackId: rackIdFromField } = parseRackKey(rawRack);
    const deviceRackId = normalizeValue(rackIdFromField || rawRack);
    if (!deviceRackId) return false;

    if (targetSiteId) {
        const deviceSiteId =
            normalizeValue(
                device?.siteId ||
                    device?.site ||
                    device?.systemId ||
                    device?.system ||
                    device?.meta?.siteId ||
                    device?.extra?.siteId,
            ) || normalizeValue(rackSiteId);
        return Boolean(deviceSiteId) && deviceSiteId === targetSiteId && deviceRackId === targetRackId;
    }

    return deviceRackId === targetRackId;
}

export function resolveDeviceSelectionKey(device) {
    const candidates = [
        device?.compositeId,
        device?.deviceId,
        device?.id,
        device?.nodeId,
        device?.serial,
    ];
    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const value = String(candidate).trim();
        if (value) return value;
    }
    return "";
}
