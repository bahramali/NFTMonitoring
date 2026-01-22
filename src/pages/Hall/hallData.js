const COMPOSITE_REGEX = /^(S\d+)-(L\d+)-([CTR]\d+)$/i;

const normalizeCompositeId = (value) => String(value ?? "").trim().toUpperCase();

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

    const [, rackId, layerId, deviceCode] = match;
    const deviceKind = deviceCode?.charAt(0)?.toUpperCase() ?? "";
    return {
        rackId,
        layerId,
        deviceCode,
        deviceKind,
    };
};

const buildInventoryFromMessages = (messages = []) => {
    const racks = new Map();
    let unmappedCount = 0;

    for (const entry of messages) {
        if (!entry) continue;
        const compositeId =
            entry.compositeId ??
            entry.composite_id ??
            entry.cid ??
            getCompositeIdFromMessage(entry);
        const parsed = parseCompositeId(compositeId);

        if (!parsed) {
            unmappedCount += 1;
            continue;
        }

        const timestamp =
            Number(entry.timestamp ?? entry.ts) ||
            getTimestampFromMessage(entry) ||
            Date.now();

        const current = racks.get(parsed.rackId) ?? {
            layers: new Set(),
            deviceCounts: { C: 0, T: 0, R: 0 },
            lastUpdate: 0,
        };

        current.layers.add(parsed.layerId);
        current.deviceCounts[parsed.deviceKind] = (current.deviceCounts[parsed.deviceKind] || 0) + 1;
        current.lastUpdate = Math.max(current.lastUpdate || 0, timestamp || 0);

        racks.set(parsed.rackId, current);
    }

    return { racks, unmappedCount };
};

const mergeRealtimeCache = (cache, newMessage) => {
    const next = new Map(cache ?? []);
    const compositeId = getCompositeIdFromMessage(newMessage);
    const normalized = normalizeCompositeId(compositeId);
    const cacheKey = normalized || "UNMAPPED";

    const timestamp = getTimestampFromMessage(newMessage) ?? Date.now();
    const payload = resolvePayload(newMessage);

    next.set(cacheKey, {
        compositeId: normalized || null,
        message: payload ?? newMessage,
        timestamp,
    });

    return next;
};

export {
    COMPOSITE_REGEX,
    normalizeCompositeId,
    extractCompositeId,
    extractTimestamp,
    getCompositeIdFromMessage,
    getTimestampFromMessage,
    parseCompositeId,
    buildInventoryFromMessages,
    mergeRealtimeCache,
};
