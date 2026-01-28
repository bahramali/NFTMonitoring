import {useCallback, useMemo, useState} from "react";
import {filterNoise, normalizeSensorData} from "../../utils.js";
import {useStomp} from "../../hooks/useStomp.js";
import {isAs7343Sensor, makeMeasurementKey, sanitize} from "./measurementUtils.js";
import {normalizeTelemetryPayload, parseEnvelope} from "../../utils/telemetryAdapter.js";

const EXTREMA_WINDOW_MS = 5 * 60 * 1000;
const RESERVED_EXTRA_KEYS = new Set([
    "controllers",
    "deviceId",
    "extra",
    "health",
    "layer",
    "meta",
    "payload",
    "sensors",
    "system",
    "compositeId",
    "online",
]);

function mergeControllers(a = [], b = []) {
    const map = new Map();
    for (const ctrl of a) {
        if (ctrl && ctrl.name) map.set(ctrl.name, ctrl);
    }
    for (const ctrl of b) {
        if (ctrl && ctrl.name) {
            const existing = map.get(ctrl.name) || {};
            map.set(ctrl.name, {...existing, ...ctrl});
        }
    }
    return Array.from(map.values());
}

export function useLiveDevices(topics) {
    const [deviceData, setDeviceData] = useState({});
    const [sensorData, setSensorData] = useState({});
    const [sensorExtrema, setSensorExtrema] = useState({});
    const [deviceEvents, setDeviceEvents] = useState({});

    const updateDeviceEvents = useCallback((compositeId, payload) => {
        if (!compositeId) return;
        setDeviceEvents((prev) => {
            const existing = Array.isArray(prev[compositeId]) ? prev[compositeId] : [];
            const nextList = [...existing, payload].slice(-200);
            return {...prev, [compositeId]: nextList};
        });
    }, []);

    const resolveOnline = useCallback((payload) => {
        if (!payload || typeof payload !== "object") return null;
        if (typeof payload.online === "boolean") return payload.online;
        if (typeof payload.isOnline === "boolean") return payload.isOnline;
        if (typeof payload.status === "boolean") return payload.status;
        if (typeof payload.state === "boolean") return payload.state;
        if (typeof payload.status === "string") {
            const normalized = payload.status.toLowerCase();
            if (normalized === "online") return true;
            if (normalized === "offline") return false;
        }
        return null;
    }, []);

    const updateSensorExtrema = useCallback((compositeId, sensors = []) => {
        if (!Array.isArray(sensors) || sensors.length === 0) return;

        const now = Date.now();

        setSensorExtrema((prev) => {
            const pendingUpdates = new Map();
            let changed = false;

            for (const sensor of sensors) {
                if (!isAs7343Sensor(sensor?.sensorName || sensor?.source)) continue;

                const normalizedType = sanitize(sensor?.sensorType || sensor?.valueType);
                if (!normalizedType) continue;

                const value = Number(sensor?.value);
                if (!Number.isFinite(value)) continue;

                const normalizedModel = sanitize(sensor?.sensorName || sensor?.source) || normalizedType;
                const measurementKey = makeMeasurementKey(normalizedType, normalizedModel);

                const previousDevice = pendingUpdates.get(compositeId) ?? prev[compositeId] ?? {};
                const previousEntry = previousDevice[measurementKey];

                let entry;
                if (!previousEntry || now - previousEntry.windowStart >= EXTREMA_WINDOW_MS) {
                    entry = { min: value, max: value, windowStart: now };
                } else {
                    const min = value < previousEntry.min ? value : previousEntry.min;
                    const max = value > previousEntry.max ? value : previousEntry.max;
                    if (min === previousEntry.min && max === previousEntry.max) {
                        continue;
                    }
                    entry = { min, max, windowStart: previousEntry.windowStart };
                }

                const deviceUpdates = { ...(pendingUpdates.get(compositeId) ?? prev[compositeId] ?? {}) };
                deviceUpdates[measurementKey] = entry;
                pendingUpdates.set(compositeId, deviceUpdates);
                changed = true;
            }

            if (!changed) return prev;

            const next = { ...prev };
            for (const [cid, data] of pendingUpdates.entries()) {
                next[cid] = data;
            }
            return next;
        });
    }, []);

    const handleStompMessage = useCallback((topic, msg) => {
        const envelope = parseEnvelope(msg);
        const kind = envelope?.kind ?? null;

        const telemetryPayload = normalizeTelemetryPayload(envelope);
        let payload = telemetryPayload ?? msg;
        if (!telemetryPayload && msg && typeof msg === "object" && "payload" in msg) {
            payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
        }

        if (!payload || typeof payload !== "object") return;

        let baseId = payload.deviceId || payload.device || payload.devId;
        let systemId = payload.system || payload.systemId;
        // Some payloads send `layer` as an object `{ layer: "L01" }` while others
        // use a plain string. Normalise to a string so the composite ID is built
        // correctly regardless of format.
        let loc = payload.layer?.layer || payload.layer || payload.meta?.layer || "";

        let compositeId =
            payload.compositeId ||
            payload.composite_id ||
            payload.cid ||
            envelope?.compositeId ||
            null;

        if ((!baseId || !systemId || !loc) && compositeId) {
            const parts = String(compositeId).split("-");
            if (parts.length >= 3) {
                systemId = systemId || parts[0];
                loc = loc || parts[1];
                baseId = baseId || parts.slice(2).join("-");
            }
        }

        baseId = baseId || "unknown";
        systemId = systemId || "unknown";

        if (!compositeId) {
            compositeId = loc ? `${loc}${baseId}` : baseId;
        }

        if (kind === "event") {
            updateDeviceEvents(compositeId, {
                ...payload,
                compositeId,
                receivedAt: Date.now(),
            });
        }

        const online = kind === "status" ? resolveOnline(payload) : null;
        if (online !== null) {
            payload = {...payload, online};
        }

        const isTelemetryTopic = kind === "telemetry" || topic === SENSOR_TOPIC;

        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = isTelemetryTopic ? filterNoise(normalized) : normalized;
            if (cleaned && isTelemetryTopic) {
                setSensorData(prev => ({...prev, [compositeId]: cleaned}));
            }

            updateSensorExtrema(compositeId, payload.sensors);
        }

        const tableData = {
            sensors: Array.isArray(payload.sensors) ? payload.sensors : [],
            controllers: Array.isArray(payload.controllers) ? payload.controllers : [],
            health: payload.health || {},
            ...(loc ? {layer: loc} : {}),
            deviceId: baseId,
            compositeId,
            receivedAt: Date.now()
        };

        if (online !== null) {
            tableData.online = online;
        }

        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            const extras = Object.entries(payload).reduce((acc, [key, value]) => {
                if (RESERVED_EXTRA_KEYS.has(key)) return acc;
                if (key === "system") return acc;
                acc[key] = value;
                return acc;
            }, {});
            if (Object.keys(extras).length > 0) {
                tableData.extra = extras;
            }
        }

        const topicKey = kind || topic;
        if (!topicKey) return;

        setDeviceData(prev => {
            const sys = {...(prev[systemId] || {})};
            const topicMap = {...(sys[topicKey] || {})};
            topicMap[compositeId] = tableData;
            return {...prev, [systemId]: {...sys, [topicKey]: topicMap}};
        });
    }, [resolveOnline, updateDeviceEvents, updateSensorExtrema]);

    useStomp(topics, handleStompMessage);

    const availableCompositeIds = useMemo(() => {
        const ids = new Set();
        for (const sysData of Object.values(deviceData)) {
            for (const topicDevices of Object.values(sysData)) {
                for (const cid of Object.keys(topicDevices)) {
                    ids.add(cid);
                }
            }
        }
        return Array.from(ids);
    }, [deviceData]);

    const mergedDevices = useMemo(() => {
        const combined = {};
        for (const sysData of Object.values(deviceData)) {
            for (const topicKey of Object.keys(sysData)) {
                for (const [cid, data] of Object.entries(sysData[topicKey])) {
                    const existing = combined[cid] || {};
                    const extra = {
                        ...(existing?.extra || {}),
                        ...(data?.extra || {})
                    };
                    const receivedAt = Math.max(
                        Number.isFinite(existing?.receivedAt) ? existing.receivedAt : 0,
                        Number.isFinite(data?.receivedAt) ? data.receivedAt : 0
                    );

                    const merged = {
                        ...existing,
                        ...data,
                        controllers: mergeControllers(existing.controllers, data.controllers)
                    };

                    if (Object.keys(extra).length > 0) {
                        merged.extra = extra;
                    }

                    if (receivedAt > 0) {
                        merged.receivedAt = receivedAt;
                    }

                    combined[cid] = merged;
                }
            }
        }
        return combined;
    }, [deviceData]);

    return {deviceData, sensorData, availableCompositeIds, mergedDevices, sensorExtrema, deviceEvents};
}
