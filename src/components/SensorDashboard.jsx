// SensorDashboard.jsx
import React, {useEffect, useMemo, useState} from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import Header from "./Header";
import {useLiveDevices} from "./dashboard/useLiveDevices";
import styles from "./SensorDashboard.module.css";
import TopicSection from "./dashboard/TopicSection";
import NotesBlock from "./dashboard/NotesBlock";
import {SENSOR_TOPIC, topics} from "./dashboard/dashboard.constants";
import {useFilters, ALL} from "../context/FiltersContext";
import Overview from "./dashboard/Overview";

function SensorDashboard() {
    const [activeSystem, setActiveSystem] = useState("S01");
    const {deviceData, sensorData, availableCompositeIds, mergedDevices} = useLiveDevices(topics, activeSystem);

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
                for (const [cid, payload] of Object.entries(devs || {})) {
                    const baseId = payload?.deviceId;
                    const layer = payload?.location?.layer || payload?.location || null;
                    if (!map[cid]) {
                        map[cid] = {system: sysId, layer, baseId, topics: new Set([topicKey])};
                    } else {
                        map[cid].topics.add(topicKey);
                    }
                }
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([cid, m]) => [cid, {
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
        return availableCompositeIds.filter((id) => {
            const meta = deviceMeta[id] || {};
            const okDev = devFilter === ALL || id === devFilter;
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
                Object.entries(devs || {}).filter(([cid]) =>
                    filteredCompositeIds.includes(cid)
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
    // Overview items (replace SystemTabs)
    // NOTE: You can feed these from any topic. For now, we try to pick a few common keys
    // from the latest payloads in the active system. Adjust the selectors as needed.
    const pickValue = (keyCandidates) => {
        for (const [, devs] of Object.entries(activeSystemTopics)) {
            for (const [, payload] of Object.entries(devs || {})) {
                const data = payload?.data || payload; // support both shapes
                for (const k of keyCandidates) {
                    if (data && data[k] != null) return data[k];
                }
            }
        }
        return null;
    };

    const overviewItems = [
        {
            key: "light",
            icon: "☀️",
            value: pickValue(["lux", "light", "illumination"]) ?? "—",
            unit: pickValue(["lux", "light", "illumination"]) != null ? "lx" : "",
            title: "Light",
            ranges: {ok: [12000, 30000], warn: [8000, 11999], danger: [0, 7999]},
        },
        {
            key: "temp",
            icon: "🌡️",
            value: pickValue(["temperature", "temp"]) ?? "—",
            unit: pickValue(["temperature", "temp"]) != null ? "℃" : "",
            title: "Temperature",
            ranges: {ok: [20, 28], warn: [28.1, 32], danger: [32.1, 100]},
        },
        {
            key: "hum",
            icon: "%",
            value: pickValue(["humidity", "hum"]) ?? "—",
            unit: pickValue(["humidity", "hum"]) != null ? "%" : "",
            title: "Humidity",
            ranges: {ok: [50, 70], warn: [40, 49.9], danger: [0, 39.9]},
        },
        {
            key: "O2",
            icon: <span style={{fontWeight: 700}}>O₂</span>,
            value: pickValue(["o2"]) ?? "—",
            unit: pickValue(["o2"]) != null ? "o2" : "",
            title: "DO",
            subtitle: "",
            ranges: {ok: [4.5, 12], warn: [3.5, 4.5], danger: [0, 3.5]},
        },
        {
            key: "flow",
            icon: "🌀",
            value: pickValue(["flowLph", "flow", "lph"]) ?? "—",
            unit: pickValue(["flowLph", "flow", "lph"]) != null ? "L/h" : "",
            title: "Flow",
            ranges: {ok: [300, 1200], warn: [150, 299], danger: [0, 149]},
        },
        {
            key: "airPump",
            icon: "🫧", // bubbles
            value: "On",
            unit: "",
            title: "Air Pump",
            stateOverride: "neutral" ///pumpRaw == null ? "neutral" : (pumpOn ? "ok" : "danger"),
        },
    ];

    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem}/>

            {/* ⬇️ NEW Overview (replaces SystemTabs) */}
            <Overview items={overviewItems}/>

            <div className={styles.section}>
                <div className={styles.sectionBody}>
                    {/* Live tables filtered by Device/Layer/System */}
                    <TopicSection systemTopics={filteredSystemTopics}/>

                    {/* Live spectrum chart for the selected device */}
                    {Object.keys(sensorTopicDevices).length > 0 && (
                        <>
                            <div className={styles.chartFilterRow}>
                                <label className={styles.filterLabel}>
                                    Device:
                                    <select
                                        className={styles.intervalSelect}
                                        value={selectedDevice}
                                        onChange={(e) => setSelectedDevice(e.target.value)}
                                    >
                                        {filteredCompositeIds.map((id) => (
                                            <option key={id} value={id}>{id}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className={styles.deviceLabel}>{selectedDevice}</div>

                            {filteredCompositeIds.includes(selectedDevice) && (
                                <div className={styles.spectrumBarChartWrapper}>
                                    <SpectrumBarChart sensorData={sensorData[selectedDevice]}/>
                                </div>
                            )}
                        </>
                    )}

                    {/* Notes based on mergedDevices */}
                    <NotesBlock mergedDevices={mergedDevices}/>

                </div>
            </div>
        </div>
    );
}

export default SensorDashboard;
