const COMPOSITE_REGEX = /^(S\d+)(?:-(R\d+))?-(L\d+)-([CTR]\d+)$/i;

const normalizeCompositeId = (value) => String(value ?? "").trim().toUpperCase();

const normalizeLocationValue = (value) => String(value ?? "").trim().toUpperCase();

const extractCompositeId = (payload) =>
    payload?.compositeId ??
    payload?.composite_id ??
    payload?.cid ??
    payload?.compositeID ??
    payload?.composite ??
    payload?.deviceCompositeId ??
    null;

const extractTimestamp = (payload) => {
    const value =
        payload?.timestamp ??
        payload?.ts ??
        payload?.time ??
        payload?.updatedAt ??
        payload?.updateTime ??
        payload?.createdAt ??
        null;

    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;

    if (value) {
        const parsed = new Date(value).getTime();
        if (Number.isFinite(parsed)) return parsed;
    }

    return null;
};

const resolvePayload = (message) => {
    if (!message || typeof message !== "object") return message;
    if (!("payload" in message)) return message;

    const payload = message.payload;
    if (typeof payload === "string") {
        try {
            return JSON.parse(payload);
        } catch {
            return message;
        }
    }

    return payload ?? message;
};

const getLocationFromMessage = (message) => {
    if (!message || typeof message !== "object") {
        return { site: null, rack: null, layer: null };
    }

    const payload = resolvePayload(message);
    return {
        site:
            payload?.site ??
            payload?.siteId ??
            payload?.system ??
            payload?.systemId ??
            message?.site ??
            message?.siteId ??
            message?.system ??
            message?.systemId ??
            null,
        rack: payload?.rack ?? payload?.rackId ?? message?.rack ?? message?.rackId ?? null,
        layer:
            payload?.layer ??
            payload?.layerId ??
            payload?.nodeId ??
            message?.layer ??
            message?.layerId ??
            message?.nodeId ??
            null,
    };
};

const getCompositeIdFromMessage = (message) => {
    const payload = resolvePayload(message);
    return extractCompositeId(payload) ?? extractCompositeId(message);
};

const getTimestampFromMessage = (message) => {
    const payload = resolvePayload(message);
    return extractTimestamp(payload) ?? extractTimestamp(message);
};

const parseCompositeId = (value) => {
    const normalized = normalizeCompositeId(value);
    const match = COMPOSITE_REGEX.exec(normalized);
    if (!match) return null;

    const [, siteId, rackSegment, layerId, deviceCode] = match;
    const deviceKind = deviceCode?.charAt(0)?.toUpperCase() ?? "";
    const rackId = rackSegment ? `${siteId}-${rackSegment}` : siteId;
    return {
        siteId,
        rackSegment,
        rackId,
        layerId,
        deviceCode,
        deviceKind,
    };
};

const getInventoryAttributes = (entry) => {
    if (!entry) {
        return {
            rackId: null,
            layer: null,
            deviceKind: null,
            timestamp: null,
        };
    }

    const message = entry.message ?? entry;
    const explicitLocation = getLocationFromMessage(message);
    const site = normalizeLocationValue(explicitLocation.site);
    const rack = normalizeLocationValue(explicitLocation.rack);
    let layer = normalizeLocationValue(explicitLocation.layer);
    let rackId = null;
    if (site && rack) {
        const normalizedSite = normalizeLocationValue(site);
        const normalizedRack = normalizeLocationValue(rack);
        rackId = normalizedRack.startsWith(`${normalizedSite}-`)
            ? normalizedRack
            : `${normalizedSite}-${normalizedRack}`;
    }
    const compositeId =
        entry.compositeId ??
        entry.composite_id ??
        entry.cid ??
        getCompositeIdFromMessage(message) ??
        getCompositeIdFromMessage(entry);
    const parsed = parseCompositeId(compositeId);
    const deviceKind = parsed?.deviceKind ?? null;

    if (!rackId && parsed) {
        rackId = parsed.rackId;
    }

    if (!layer && parsed?.layerId) {
        layer = parsed.layerId;
    }

    const timestamp =
        Number(entry.timestamp ?? entry.ts) ||
        getTimestampFromMessage(message) ||
        getTimestampFromMessage(entry) ||
        Date.now();

    return {
        rackId,
        layer,
        deviceKind,
        timestamp,
    };
};

export {
    COMPOSITE_REGEX,
    normalizeCompositeId,
    extractCompositeId,
    extractTimestamp,
    resolvePayload,
    getLocationFromMessage,
    getCompositeIdFromMessage,
    getTimestampFromMessage,
    parseCompositeId,
    getInventoryAttributes,
};
