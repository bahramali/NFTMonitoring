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
    if (compositeSegments.includes(normalizedRackId)) {
        return true;
    }

    const mqttSegments = splitSegments(device?.mqttTopic);
    if (mqttSegments.includes(normalizedRackId)) {
        return true;
    }

    return false;
}
