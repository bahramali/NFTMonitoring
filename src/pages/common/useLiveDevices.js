import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { filterNoise, normalizeSensorData } from "../../utils.js";
import { useStomp } from "../../hooks/useStomp.js";
import { isAs7343Sensor, makeMeasurementKey, sanitize } from "./measurementUtils.js";
import { adaptFlatTelemetryToSensors } from "../../utils/telemetryAdapter.js";
import { logTelemetryDebug } from "./liveTelemetry.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
    buildDeviceKey,
    describeIdentity,
    isIdentityComplete,
    matchesScope,
    resolveIdentity,
} from "../../utils/deviceIdentity.js";

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
    "farmId",
    "unitType",
    "unitId",
    "layerId",
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

export function useLiveDevices(topics, { scope } = {}) {
    const { token } = useAuth();
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
                pending.sensorData.forEach((data, deviceKey) => {
                    next[deviceKey] = data;
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
                        topicUpdates.forEach((data, deviceKey) => {
                            nextTopic[deviceKey] = data;
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

    const updateDeviceEvents = useCallback((deviceKey, payload) => {
        if (!deviceKey) return;
        setDeviceEvents((prev) => {
            const existing = Array.isArray(prev[deviceKey]) ? prev[deviceKey] : [];
            const nextList = [...existing, payload].slice(-200);
            return {...prev, [deviceKey]: nextList};
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

    const updateSensorExtrema = useCallback((deviceKey, sensors = []) => {
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

                const previousDevice = pendingUpdates.get(deviceKey) ?? prev[deviceKey] ?? {};
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

                const deviceUpdates = { ...(pendingUpdates.get(deviceKey) ?? prev[deviceKey] ?? {}) };
                deviceUpdates[measurementKey] = entry;
                pendingUpdates.set(deviceKey, deviceUpdates);
                changed = true;
            }

            if (!changed) return prev;

            const next = { ...prev };
            for (const [key, data] of pendingUpdates.entries()) {
                next[key] = data;
            }
            return next;
        });
    }, []);

    const subscribedTopics = useMemo(() => {
        const list = Array.isArray(topics) ? topics : [topics];
        return list.filter(Boolean);
    }, [topics]);

    const connectHeaders = useMemo(() => {
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    }, [token]);

    const handleStompMessage = useCallback((topic, msg) => {
        logTelemetryDebug("received message", {
            topic,
            keys: msg && typeof msg === "object" ? Object.keys(msg) : [],
        });
        const envelope = msg && typeof msg === "object" ? msg : null;
        const kind = envelope?.kind || null;
        const mqttTopic = envelope?.mqttTopic || null;

        let payload = envelope?.payload ?? msg;
        // Fix schema mismatch: backend timestamp is on envelope, UI expects it on payload.
        if (envelope && payload && typeof payload === "object" && !Array.isArray(payload)) {
            if (payload.timestamp == null && envelope.timestamp != null) {
                payload = {...payload, timestamp: envelope.timestamp};
            }
        }
        if (typeof payload === "string") {
            try {
                payload = JSON.parse(payload);
            } catch {
                payload = envelope?.payload ?? msg;
            }
        }

        if (!payload || typeof payload !== "object") return;

        if (envelope && typeof envelope === "object" && payload && typeof payload === "object") {
            if (payload.timestamp == null && envelope.timestamp != null) {
                payload.timestamp = envelope.timestamp;
            }
        }

        const identity = resolveIdentity(payload, envelope);
        if (!isIdentityComplete(identity)) {
            console.warn("Live telemetry message missing identity fields", {
                topic,
                identity: describeIdentity(identity),
            });
            return;
        }

        if (!matchesScope(identity, scope)) return;

        const deviceKey = buildDeviceKey(identity);
        if (!deviceKey) {
            console.warn("Live telemetry message missing identity fields", {
                topic,
                identity: describeIdentity(identity),
            });
            return;
        }

        if (kind === "event") {
            updateDeviceEvents(deviceKey, {
                ...payload,
                ...identity,
                deviceKey,
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
                pendingUpdatesRef.current.sensorData.set(deviceKey, cleaned);
                scheduleFlush();
            }

            updateSensorExtrema(deviceKey, payload.sensors);
        }

        const tableData = {
            sensors: Array.isArray(payload.sensors) ? payload.sensors : [],
            controllers: Array.isArray(payload.controllers) ? payload.controllers : [],
            health: payload.health || {},
            ...identity,
            deviceKey,
            kind,
            mqttTopic,
            timestamp: resolveTimestamp(payload),
            receivedAt: Date.now(),
        };

        if (online !== null) {
            tableData.online = online;
        }

        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
            const extras = Object.entries(payload).reduce((acc, [key, value]) => {
                if (RESERVED_EXTRA_KEYS.has(key)) return acc;
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
        const farmKey = identity.farmId || "unknown";
        if (!pendingDeviceData.has(farmKey)) {
            pendingDeviceData.set(farmKey, new Map());
        }
        const siteMap = pendingDeviceData.get(farmKey);
        if (!siteMap.has(topicKey)) {
            siteMap.set(topicKey, new Map());
        }
        siteMap.get(topicKey).set(deviceKey, tableData);
        scheduleFlush();
    }, [resolveOnline, resolveTimestamp, scheduleFlush, scope, updateDeviceEvents, updateSensorExtrema]);

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

    useStomp(subscribedTopics, handleStompMessage, {
        connectHeaders,
        reconnectOnHeaderChange: true,
    });

    const availableDeviceKeys = useMemo(() => {
        const ids = new Set();
        for (const sysData of Object.values(deviceData)) {
            for (const topicDevices of Object.values(sysData)) {
                for (const key of Object.keys(topicDevices)) {
                    ids.add(key);
                }
            }
        }
        return Array.from(ids);
    }, [deviceData]);

    const mergedDevices = useMemo(() => {
        const combined = {};
        for (const sysData of Object.values(deviceData)) {
            for (const topicKey of Object.keys(sysData)) {
                for (const [deviceKey, data] of Object.entries(sysData[topicKey])) {
                    const existing = combined[deviceKey] || {};
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

                    combined[deviceKey] = merged;
                }
            }
        }
        return combined;
    }, [deviceData]);

    return {deviceData, sensorData, availableDeviceKeys, mergedDevices, sensorExtrema, deviceEvents};
}
