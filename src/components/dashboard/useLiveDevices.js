import {useCallback, useMemo, useState} from "react";
import {filterNoise, normalizeSensorData} from "../../utils";
import {useStomp} from "../../hooks/useStomp";
import {SENSOR_TOPIC} from "./dashboard.constants";

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
        const loc = payload.location || payload.Location || payload.meta?.location || "";
        const compositeId = loc ? `${loc}${baseId}` : baseId;

        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = topic === SENSOR_TOPIC ? filterNoise(normalized) : normalized;
            if (cleaned && topic === SENSOR_TOPIC) {
                setSensorData(prev => ({...prev, [baseId]: cleaned}));
            }
        }

        const tableData = {
            sensors: Array.isArray(payload.sensors) ? payload.sensors : [],
            health: payload.health || {},
            ...(loc ? {location: loc} : {}),
            deviceId: baseId
        };

        setDeviceData(prev => {
            const sys = {...(prev[systemId] || {})};
            const topicMap = {...(sys[topic] || {})};
            topicMap[compositeId] = tableData;
            return {...prev, [systemId]: {...sys, [topic]: topicMap}};
        });
    }, []);

    useStomp(topics, handleStompMessage);

    const sysData = deviceData[activeSystem] || {};

    const availableBaseIds = useMemo(() => {
        const ids = new Set();
        for (const topicDevices of Object.values(sysData)) {
            for (const d of Object.values(topicDevices)) {
                ids.add(d?.deviceId || "unknown");
            }
        }
        return Array.from(ids);
    }, [sysData]);

    const mergedDevices = useMemo(() => {
        const sysData = deviceData[activeSystem] || {};
        const combined = {};
        for (const topicKey of Object.keys(sysData)) {
            for (const [cid, data] of Object.entries(sysData[topicKey])) {
                combined[cid] = {...(combined[cid] || {}), ...data};
            }
        }
        return combined;
    }, [deviceData, activeSystem]);

    return {deviceData, sensorData, availableBaseIds, mergedDevices};
}

