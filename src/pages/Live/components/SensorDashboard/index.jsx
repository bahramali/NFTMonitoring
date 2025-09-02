// SensorDashboard.jsx
import React, {useEffect, useMemo, useState} from "react";
import Header from "../../../common/Header";
import { useLiveDevices } from "../../../common/useLiveDevices.js";
import styles from "./SensorDashboard.module.css";
import Live from "../Live";
import {SENSOR_TOPIC, topics} from "../../../common/dashboard.constants.js";
import {useFilters, ALL} from "../../../../context/FiltersContext";

function SensorDashboard({ view, title = '' }) {
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

    return (
        <div className={styles.dashboard}>
            <Header title={title}/>
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
