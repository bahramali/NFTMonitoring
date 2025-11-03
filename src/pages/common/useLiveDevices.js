import {useCallback, useMemo, useState} from "react";
import {filterNoise, normalizeSensorData} from "../../utils.js";
import {useStomp} from "../../hooks/useStomp.js";
import {SENSOR_TOPIC} from "./dashboard.constants.js";
import {isAs7343Sensor, makeMeasurementKey, sanitize} from "./measurementUtils.js";

const EXTREMA_WINDOW_MS = 5 * 60 * 1000;

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
        let payload = msg;
        if (msg && typeof msg === "object" && "payload" in msg) {
            payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
        }

        const baseId = payload.deviceId || "unknown";
        const systemId = payload.system || "unknown";
        // Some payloads send `layer` as an object `{ layer: "L01" }` while others
        // use a plain string. Normalise to a string so the composite ID is built
        // correctly regardless of format.
        const loc = payload.layer?.layer || payload.layer || payload.meta?.layer || "";
        const compositeId = payload.compositeId || (loc ? `${loc}${baseId}` : baseId);

        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = topic === SENSOR_TOPIC ? filterNoise(normalized) : normalized;
            if (cleaned && topic === SENSOR_TOPIC) {
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
            compositeId
        };

        setDeviceData(prev => {
            const sys = {...(prev[systemId] || {})};
            const topicMap = {...(sys[topic] || {})};
            topicMap[compositeId] = tableData;
            return {...prev, [systemId]: {...sys, [topic]: topicMap}};
        });
    }, [updateSensorExtrema]);

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
                    combined[cid] = {
                        ...existing,
                        ...data,
                        controllers: mergeControllers(existing.controllers, data.controllers)
                    };
                }
            }
        }
        return combined;
    }, [deviceData]);

    return {deviceData, sensorData, availableCompositeIds, mergedDevices, sensorExtrema};
}

