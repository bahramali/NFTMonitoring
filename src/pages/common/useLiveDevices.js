import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {filterNoise, normalizeSensorData} from "../../utils.js";
import {useStomp} from "../../hooks/useStomp.js";
import {isAs7343Sensor, makeMeasurementKey, sanitize} from "./measurementUtils.js";
import {adaptFlatTelemetryToSensors} from "../../utils/telemetryAdapter.js";
import {logTelemetryDebug} from "./liveTelemetry.js";

const EXTREMA_WINDOW_MS = 5 * 60 * 1000;
const TELEMETRY_TOPIC = "hydroleaf/telemetry";
const BATCH_INTERVAL_MS = process.env.NODE_ENV === "test" ? 0 : 300;
const RESERVED_EXTRA_KEYS = new Set([
    "controllers",
    "deviceId",
    "extra",
    "health",
    "layer",
    "meta",
    "mqttTopic",
    "payload",
    "sensors",
    "site",
    "siteId",
    "rack",
    "rackId",
    "system",
    "compositeId",
    "nodeType",
    "nodeId",
    "nodeInstance",
    "kind",
    "online",
    "schemaVersion",
    "timestamp",
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
    const pendingUpdatesRef = useRef({deviceData: new Map(), sensorData: new Map()});
    const flushTimeoutRef = useRef(null);

    const flushPending = useCallback((pending) => {
        if (pending.sensorData.size > 0) {
            setSensorData((prev) => {
                const next = {...prev};
                pending.sensorData.forEach((data, compositeId) => {
                    next[compositeId] = data;
                });
                return next;
            });
        }

        if (pending.deviceData.size > 0) {
            setDeviceData((prev) => {
                let next = prev;
                pending.deviceData.forEach((topicsMap, site) => {
                    const prevSite = next[site] || {};
                    let siteChanged = false;
                    const nextSite = {...prevSite};

                    topicsMap.forEach((topicUpdates, topicKey) => {
                        const prevTopic = prevSite[topicKey] || {};
                        let topicChanged = false;
                        const nextTopic = {...prevTopic};
                        topicUpdates.forEach((data, compositeId) => {
                            nextTopic[compositeId] = data;
                            topicChanged = true;
                        });
                        if (topicChanged) {
                            nextSite[topicKey] = nextTopic;
                            siteChanged = true;
                        }
                    });

                    if (siteChanged) {
                        if (next === prev) {
                            next = {...prev};
                        }
                        next[site] = nextSite;
                    }
                });
                return next;
            });
        }
    }, []);

    const scheduleFlush = useCallback(() => {
        if (BATCH_INTERVAL_MS === 0) {
            const pending = pendingUpdatesRef.current;
            pendingUpdatesRef.current = {deviceData: new Map(), sensorData: new Map()};
            flushPending(pending);
            return;
        }
        if (flushTimeoutRef.current) return;
        flushTimeoutRef.current = setTimeout(() => {
            const pending = pendingUpdatesRef.current;
            pendingUpdatesRef.current = {deviceData: new Map(), sensorData: new Map()};
            flushTimeoutRef.current = null;
            flushPending(pending);
        }, BATCH_INTERVAL_MS);
    }, [flushPending]);

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

    const resolveTimestamp = useCallback((payload) => {
        if (!payload || typeof payload !== "object") return null;
        const candidate = payload.timestamp ?? payload.ts ?? payload.time ?? payload.receivedAt;
        if (candidate === undefined || candidate === null) return null;
        if (typeof candidate === "number") {
            return Number.isFinite(candidate) ? candidate : null;
        }
        const parsed = Date.parse(candidate);
        return Number.isNaN(parsed) ? null : parsed;
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

    const subscribedTopics = useMemo(() => {
        const list = Array.isArray(topics) ? topics : [topics];
        return list.filter(Boolean);
    }, [topics]);

    const handleStompMessage = useCallback((topic, msg) => {
        logTelemetryDebug("received message", {
            topic,
            keys: msg && typeof msg === "object" ? Object.keys(msg) : [],
        });
        const envelope = msg && typeof msg === "object" ? msg : null;
        const kind = envelope?.kind || null;
        const mqttTopic = envelope?.mqttTopic || null;

        let payload = envelope?.payload ?? msg;
        if (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch {
                payload = envelope?.payload ?? msg;
            }
        }

        if (!payload || typeof payload !== "object") return;

        let baseId = envelope?.deviceId || payload.deviceId || payload.device || payload.devId;
        let systemId = payload.system || payload.systemId || payload.site || envelope?.site;
        let siteId = payload.siteId || payload.site_id || payload.site || envelope?.site;
        let rackId = payload.rackId || payload.rack_id || payload.rack || envelope?.rack;
        // Some payloads send `layer` as an object `{ layer: "L01" }` while others
        // use a plain string. Normalise to a string so the composite ID is built
        // correctly regardless of format.
        let loc =
            envelope?.layer?.layer ||
            envelope?.layer ||
            payload.layer?.layer ||
            payload.layer ||
            payload.meta?.layer ||
            "";
        const nodeType = payload.nodeType || payload.node_type || payload.meta?.nodeType || payload.meta?.node_type || null;
        const nodeId = payload.nodeId || payload.node_id || payload.meta?.nodeId || payload.meta?.node_id || null;
        const nodeInstance =
            payload.nodeInstance || payload.node_instance || payload.meta?.nodeInstance || payload.meta?.node_instance || null;

        let compositeId =
            envelope?.compositeId ||
            payload.compositeId ||
            payload.composite_id ||
            payload.cid ||
            null;

        baseId = baseId || "unknown";
        systemId = systemId || "unknown";
        siteId = siteId || systemId;
        rackId = rackId || null;

        if (!compositeId) {
            const segments = [siteId, rackId, loc || nodeId, baseId].filter(Boolean);
            compositeId = segments.length > 0 ? segments.join("-") : baseId;
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

        const isTelemetryTopic = kind === "telemetry" || (!kind && topic === TELEMETRY_TOPIC);

        if (kind === "telemetry" && !Array.isArray(payload.sensors)) {
            const adapted = adaptFlatTelemetryToSensors(payload);
            payload = { ...payload, ...adapted };
        }

        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = isTelemetryTopic ? filterNoise(normalized) : normalized;
            if (cleaned && isTelemetryTopic) {
                pendingUpdatesRef.current.sensorData.set(compositeId, cleaned);
                scheduleFlush();
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
            kind,
            mqttTopic,
            ...(siteId ? {site: siteId} : {}),
            ...(rackId ? {rack: rackId} : {}),
            ...(siteId ? {siteId} : {}),
            ...(rackId ? {rackId} : {}),
            ...(nodeType ? {nodeType} : {}),
            ...(nodeId ? {nodeId} : {}),
            ...(nodeInstance !== null && nodeInstance !== undefined ? {nodeInstance} : {}),
            timestamp: resolveTimestamp(payload),
            receivedAt: Date.now(),
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

        const pendingDeviceData = pendingUpdatesRef.current.deviceData;
        if (!pendingDeviceData.has(siteId)) {
            pendingDeviceData.set(siteId, new Map());
        }
        const siteMap = pendingDeviceData.get(siteId);
        if (!siteMap.has(topicKey)) {
            siteMap.set(topicKey, new Map());
        }
        siteMap.get(topicKey).set(compositeId, tableData);
        scheduleFlush();
    }, [resolveOnline, resolveTimestamp, scheduleFlush, updateDeviceEvents, updateSensorExtrema]);

    useEffect(() => {
        if (subscribedTopics.length > 0) {
            logTelemetryDebug("subscribed topics", subscribedTopics);
        }
    }, [subscribedTopics]);

    useEffect(() => {
        return () => {
            if (flushTimeoutRef.current) {
                clearTimeout(flushTimeoutRef.current);
            }
        };
    }, []);

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
