export function normalizeRackId(rackId) {
    if (rackId === null || rackId === undefined) return "";
    return String(rackId).trim().toLowerCase();
}

function splitSegments(value) {
    if (!value) return [];
    return String(value)
        .toLowerCase()
        .split(/[\/\-_:]+/)
        .filter(Boolean);
}

export function deviceMatchesRack(device, rackId) {
    const normalizedRackId = normalizeRackId(rackId);
    if (!normalizedRackId) return false;

    const rackSegments = splitSegments(normalizedRackId);
    if (!rackSegments.length) return false;

    const systemId =
        device?.systemId || device?.extra?.systemId || device?.meta?.systemId || device?.system;
    const directRackId =
        device?.rackId ||
        device?.extra?.rackId ||
        device?.extra?.rack_id ||
        device?.rack ||
        device?.rack_id ||
        device?.meta?.rack;

    if (systemId && directRackId) {
        const normalizedComposite = normalizeRackId(`${systemId}-${directRackId}`);
        if (normalizedComposite === normalizedRackId) return true;
    }

    const candidates = [
        device?.extra?.rackId,
        device?.extra?.rack_id,
        device?.rackId,
        device?.rack,
        device?.rack_id,
        device?.meta?.rack,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (normalizeRackId(candidate) === normalizedRackId) return true;
    }

    const compositeSegments = splitSegments(device?.compositeId);
    if (rackSegments.every((segment) => compositeSegments.includes(segment))) {
        return true;
    }

    const mqttSegments = splitSegments(device?.mqttTopic);
    if (rackSegments.every((segment) => mqttSegments.includes(segment))) {
        return true;
    }

    return false;
}
