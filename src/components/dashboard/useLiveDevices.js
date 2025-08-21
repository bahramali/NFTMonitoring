import {useCallback, useMemo, useState} from "react";
import {filterNoise, normalizeSensorData} from "../../utils";
import {useStomp} from "../../hooks/useStomp";
import {SENSOR_TOPIC} from "./dashboard.constants";

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

export function useLiveDevices(topics, activeSystem) {
    const [deviceData, setDeviceData] = useState({});
    const [sensorData, setSensorData] = useState({});

    const handleStompMessage = useCallback((topic, msg) => {
        let payload = msg;
        if (msg && typeof msg === "object" && "payload" in msg) {
            payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
        }

        const baseId = payload.deviceId || "unknown";
        const systemId = payload.system || "unknown";
        const loc = payload.layer || payload.layer || payload.meta?.layer || "";
        const compositeId = payload.compositeId || (loc ? `${loc}${baseId}` : baseId);

        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = topic === SENSOR_TOPIC ? filterNoise(normalized) : normalized;
            if (cleaned && topic === SENSOR_TOPIC) {
                setSensorData(prev => ({...prev, [compositeId]: cleaned}));
            }
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
    }, []);

    useStomp(topics, handleStompMessage);

    const availableCompositeIds = useMemo(() => {
        const ids = new Set();
        const isAll = String(activeSystem).toLowerCase() === "all";
        const systems = isAll ? Object.values(deviceData) : [deviceData[activeSystem] || {}];

        for (const sysData of systems) {
            for (const topicDevices of Object.values(sysData || {})) {
                for (const cid of Object.keys(topicDevices)) {
                    ids.add(cid);
                }
            }
        }

        return Array.from(ids);
    }, [deviceData, activeSystem]);

    const mergedDevices = useMemo(() => {
        const combined = {};
        const isAll = String(activeSystem).toLowerCase() === "all";
        const systems = isAll ? Object.values(deviceData) : [deviceData[activeSystem] || {}];

        for (const sysData of systems) {
            for (const topicKey of Object.keys(sysData || {})) {
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
    }, [deviceData, activeSystem]);

    return {deviceData, sensorData, availableCompositeIds, mergedDevices};
}

