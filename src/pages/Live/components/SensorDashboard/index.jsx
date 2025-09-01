// SensorDashboard.jsx
import React, {useEffect, useMemo, useState} from "react";
import Header from "../../../common/Header";
import { useLiveDevices } from "../../../common/useLiveDevices.js";
import { useLiveNow } from "../../../../hooks/useLiveNow";
import styles from "../../../common/SensorDashboard.module.css";
import Live from "../Live";
import {SENSOR_TOPIC, topics} from "../../../common/dashboard.constants.js";
import {useFilters, ALL} from "../../../../context/FiltersContext";
import Overview from "../Overview";
import idealRangeConfig from "../../../../idealRangeConfig.js";

function SensorDashboard({ view, title = '' }) {
    const [activeSystem, setActiveSystem] = useState("S01");
    const {deviceData, sensorData, availableCompositeIds, mergedDevices} = useLiveDevices(topics, activeSystem);
    // aggregated metrics from the `live_now` topic
    const liveNow = useLiveNow() || {};

    const [selectedDevice, setSelectedDevice] = useState("");

    // Filters from the sidebar
    const {
        device: devFilter,
        layer: layerFilter,
        system: sysFilter,
        topic: topicFilter,
        setLists,
    } = useFilters();

    // Topics for the currently active system across all topic streams
    const activeSystemTopics = deviceData[activeSystem] || {};
    const sensorTopicDevices = activeSystemTopics[SENSOR_TOPIC] || {};

    // ──────────────────────────────
    // 1) Build metadata: compositeId -> { system, layer, baseId, topics: [] }
    const deviceMeta = useMemo(() => {
        const map = {};
        for (const [sysId, topicsObj] of Object.entries(deviceData || {})) {
            for (const [topicKey, devs] of Object.entries(topicsObj || {})) {
                for (const [compositeId, payload] of Object.entries(devs || {})) {
                    const baseId = payload?.deviceId;
                    const layer = payload?.layer?.layer || payload?.layer || null;
                    if (!map[compositeId]) {
                        map[compositeId] = {system: sysId, layer, baseId, topics: new Set([topicKey])};
                    } else {
                        map[compositeId].topics.add(topicKey);
                    }
                }
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([compositeId, m]) => [compositeId, {
                system: m.system,
                layer: m.layer,
                baseId: m.baseId,
                topics: Array.from(m.topics)
            }])
        );
    }, [deviceData]);

    // 2) Populate sidebar lists (Device / Layer / System)
    useEffect(() => {
        const devices = Object.keys(deviceMeta);
        const layers = Array.from(
            new Set(Object.values(deviceMeta).map((m) => m.layer).filter(Boolean))
        );
        const systems = Object.keys(deviceData || {});
        const topicsList = Array.from(
            new Set(
                Object.values(deviceData || {}).flatMap((sys) => Object.keys(sys || {}))
            )
        );
        setLists({devices, layers, systems, topics: topicsList});
    }, [deviceMeta, deviceData, setLists]);

    // 3) Keep activeSystem in sync with the System filter
    useEffect(() => {
        if (sysFilter !== ALL && sysFilter !== activeSystem) {
            setActiveSystem(sysFilter);
        }
    }, [sysFilter, activeSystem]);

    // 4) Filter available device IDs based on all active filters
    const filteredCompositeIds = useMemo(() => {
        return availableCompositeIds.filter((compositeId) => {
            const meta = deviceMeta[compositeId] || {};
            const okDev = devFilter === ALL || compositeId === devFilter;
            const okLay = layerFilter === ALL || meta.layer === layerFilter;
            const okSys = sysFilter === ALL || meta.system === sysFilter;
            const okTopic = topicFilter === ALL || (meta.topics || []).includes(topicFilter);
            return okDev && okLay && okSys && okTopic;
        });
    }, [availableCompositeIds, deviceMeta, devFilter, layerFilter, sysFilter, topicFilter]);

    // 5) Filter topics for live tables based on filtered devices
    const filteredSystemTopics = useMemo(() => {
        const out = {};
        for (const [topic, devs] of Object.entries(activeSystemTopics || {})) {
            if (topicFilter !== ALL && topic !== topicFilter) continue;
            out[topic] = Object.fromEntries(
                Object.entries(devs || {}).filter(([compositeId]) =>
                    filteredCompositeIds.includes(compositeId)
                )
            );
        }
        return out;
    }, [activeSystemTopics, filteredCompositeIds, topicFilter]);

    // 6) Ensure selectedDevice remains valid after filters change
    useEffect(() => {
        if (filteredCompositeIds.length && !filteredCompositeIds.includes(selectedDevice)) {
            setSelectedDevice(filteredCompositeIds[0]);
        }
    }, [filteredCompositeIds, selectedDevice]);

    // ──────────────────────────────
    // Overview items sourced from the aggregated `live_now` topic
    const overviewItems = useMemo(() => {
        const norm = (name) => String(name).replace(/[\s_-]/g, "").toLowerCase();
        const metric = (name) => liveNow[norm(name)] || {};

        const items = [
            {
                key: "light",
                icon: "☀️",
                value: metric("light").average ?? "—",
                unit: metric("light").average != null ? "lx" : "",
                title: "Light",
                subtitle: `Composite IDs: ${metric("light").deviceCount ?? 0}`,
                range: idealRangeConfig.lux?.idealRange,
            },
            {
                key: "temperature",
                icon: "🌡️",
                value: metric("temperature").average ?? "—",
                unit: metric("temperature").average != null ? "℃" : "",
                title: "Temperature",
                subtitle: `Composite IDs: ${metric("temperature").deviceCount ?? 0}`,
                range: idealRangeConfig.temperature?.idealRange,
            },
            {
                key: "humidity",
                icon: "%",
                value: metric("humidity").average ?? "—",
                unit: metric("humidity").average != null ? "%" : "",
                title: "Humidity",
                subtitle: `Composite IDs: ${metric("humidity").deviceCount ?? 0}`,
                range: idealRangeConfig.humidity?.idealRange,
            },
            {
                key: "dissolvedOxygen",
                icon: <span style={{fontWeight: 700}}>O₂</span>,
                value: metric("dissolvedOxygen").average ?? "—",
                unit: metric("dissolvedOxygen").average != null ? "mg/L" : "",
                title: "DO",
                subtitle: `Composite IDs: ${metric("dissolvedOxygen").deviceCount ?? 0}`,
                range: idealRangeConfig.dissolvedOxygen?.idealRange,
            },
        ];

        const controllerMeta = {
            airpump: { icon: "🫧", title: "Air Pump" },
        };
        const sensorKeys = ["light", "temperature", "humidity", "dissolvedoxygen"];

        const controllers = Object.entries(liveNow || {})
            .filter(([k]) => !sensorKeys.includes(norm(k)))
            .map(([k, v]) => {
                const key = norm(k);
                const meta = controllerMeta[key] || {};
                return {
                    key,
                    icon: meta.icon || "🔧",
                    value: v?.average == null ? "—" : v.average == 1 ? "On" : "Off",
                    unit: "",
                    title: meta.title || k,
                    subtitle: `Composite IDs: ${v?.deviceCount ?? 0}`,
                };
            });

        return [...items, ...controllers];
    }, [liveNow]);

    return (
        <div className={styles.dashboard}>
            <Header title={title}/>

            {view !== 'live' && <Overview items={overviewItems}/>}

            {view !== 'overview' && (
                <Live
                    filteredSystemTopics={filteredSystemTopics}
                    sensorTopicDevices={sensorTopicDevices}
                    selectedDevice={selectedDevice}
                    setSelectedDevice={setSelectedDevice}
                    filteredCompositeIds={filteredCompositeIds}
                    sensorData={sensorData}
                    mergedDevices={mergedDevices}
                />
            )}
        </div>
    );
}

export default SensorDashboard;
