import { describeIdentity, resolveIdentity } from "../../utils/deviceIdentity.js";

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

const getIdentityFromMessage = (message) => {
    const payload = resolvePayload(message);
    return resolveIdentity(payload, message);
};

const getTimestampFromMessage = (message) => {
    const payload = resolvePayload(message);
    return extractTimestamp(payload) ?? extractTimestamp(message);
};

const getInventoryAttributes = (entry) => {
    if (!entry) {
        return {
            rackId: null,
            layer: null,
            deviceKind: null,
            timestamp: null,
            identity: null,
        };
    }

    const message = entry.message ?? entry;
    const identity = getIdentityFromMessage(message);
    const described = describeIdentity(identity);
    const rackId = described.unitType === "rack" ? described.unitId : null;
    const layer = described.layerId || "No layer";
    const deviceKind = described.deviceId ? described.deviceId.charAt(0).toUpperCase() : null;

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
        identity: described,
    };
};

export {
    extractTimestamp,
    resolvePayload,
    getIdentityFromMessage,
    getTimestampFromMessage,
    getInventoryAttributes,
};
