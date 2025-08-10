// SensorDashboard.jsx
import React, {useEffect, useMemo, useState} from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import Header from "./Header";
import {useLiveDevices} from "./dashboard/useLiveDevices";
import {useHistory} from "./dashboard/useHistory";
import styles from "./SensorDashboard.module.css";
import SystemTabs from "./dashboard/SystemTabs";
import VerticalTabs from "./dashboard/VerticalTabs";
import TopicSection from "./dashboard/TopicSection";
import ReportControls from "./dashboard/ReportControls";
import ReportCharts from "./dashboard/ReportCharts";
import NotesBlock from "./dashboard/NotesBlock";
import {SENSOR_TOPIC, topics} from "./dashboard/dashboard.constants";
import {toLocalInputValue, formatTime} from "./dashboard/dashboard.utils";
import { useFilters, ALL } from "../context/FiltersContext";


function SensorDashboard() {
    const [activeSystem, setActiveSystem] = useState("S01");
    const {deviceData, sensorData, availableCompositeIds, mergedDevices} = useLiveDevices(topics, activeSystem);

    const [selectedDevice, setSelectedDevice] = useState("");
    const [activeTab, setActiveTab] = useState("live");

    const now = Date.now();
    const [fromDate, setFromDate] = useState(toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000)));
    const [toDate, setToDate] = useState(toLocalInputValue(new Date(now)));

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    // Filters from the sidebar
  const {
    device: devFilter,
    layer: layerFilter,
    system: sysFilter,
    topic: topicFilter,
    setLists,
  } = useFilters();

    // History data for the selected device
  const selectedBaseId = useMemo(() => {
    const sysTopics = deviceData[activeSystem] || {};
    for (const topicDevices of Object.values(sysTopics)) {
      if (selectedDevice in topicDevices) {
        return topicDevices[selectedDevice].deviceId || selectedDevice;
      }
    }
    return selectedDevice;
  }, [deviceData, activeSystem, selectedDevice]);

  const {
    rangeData,
    tempRangeData,
    phRangeData,
    ecTdsRangeData,
    doRangeData,
    xDomain,
    startTime,
    endTime,
    fetchReportData,
  } = useHistory(selectedBaseId, fromDate, toDate, autoRefresh, refreshInterval);

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
                        map[cid] = { system: sysId, layer, baseId, topics: new Set([topicKey]) };
                    } else {
                        map[cid].topics.add(topicKey);
                    }
                }
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([cid, m]) => [cid, { system: m.system, layer: m.layer, baseId: m.baseId, topics: Array.from(m.topics) }])
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
        setLists({ devices, layers, systems, topics: topicsList });
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

    // 7) Determine which report sections to display based on selected device's sensor types
    const sensorTypesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.type || s.valueType || '').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const sensorNamesForSelected = useMemo(() => {
        const match = sensorTopicDevices[selectedDevice];
        const sensors = match?.sensors || [];
        return sensors.map((s) => (s.sensorName || s.source || '-').toLowerCase());
    }, [sensorTopicDevices, selectedDevice]);

    const showTempHum = sensorNamesForSelected.includes("sht3x");
    // AS7343 sensor provides spectrum data and clear lux readings. Some
    // deployments still report the older AS7341 sensor name, so support
    // both to ensure reports display when either sensor is present.
    const hasAs734x =
        sensorNamesForSelected.includes("as7343") ||
        sensorNamesForSelected.includes("as7341");
    const showSpectrum = hasAs734x;
    const showClearLux =
        sensorNamesForSelected.includes("veml7700") ||
        hasAs734x;
    const showPh = sensorTypesForSelected.includes("ph");
    const showEcTds =
        sensorTypesForSelected.includes("ec") ||
        sensorTypesForSelected.includes("tds");
    const showDo =
        sensorTypesForSelected.includes("do") ||
        sensorTypesForSelected.includes("dissolvedoxygen");
    const showAnyReport = showTempHum || showSpectrum || showClearLux || showPh || showEcTds || showDo;


    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem}/>

            {/* Vertical tab bar (Live / Report) */}
            <VerticalTabs activeTab={activeTab} onChange={setActiveTab}/>

            {/* System selection tabs */}
            <SystemTabs systems={Object.keys(deviceData)} activeSystem={activeSystem} onChange={setActiveSystem}/>

            {activeTab === "live" && (
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
            )}

            {activeTab === "report" && (
                <div className={styles.section}>
                    <div className={styles.sectionBody}>
                        {!showAnyReport ? (
                            <div>No reports available for this device.</div>
                        ) : (
                            <>
                                <ReportControls
                                    fromDate={fromDate}
                                    toDate={toDate}
                                    onFromDateChange={(e) => setFromDate(e.target.value)}
                                    onToDateChange={(e) => setToDate(e.target.value)}
                                    onNow={() => setToDate(toLocalInputValue(new Date()))}
                                    onApply={fetchReportData}
                                    selectedDevice={selectedDevice}
                                    availableCompositeIds={filteredCompositeIds} // filtered list
                                    onDeviceChange={(e) => setSelectedDevice(e.target.value)}
                                    autoRefresh={autoRefresh}
                                    onAutoRefreshChange={(e) => setAutoRefresh(e.target.checked)}
                                    refreshInterval={refreshInterval}
                                    onRefreshIntervalChange={(e) =>
                                        setRefreshInterval(Number(e.target.value))
                                    }
                                    rangeLabel={`From: ${formatTime(startTime)} until: ${formatTime(endTime)}`}
                                />

                                <ReportCharts
                                    showTempHum={showTempHum}
                                    showSpectrum={showSpectrum}
                                    showClearLux={showClearLux}
                                    showPh={showPh}
                                    showEcTds={showEcTds}
                                    showDo={showDo}
                                    rangeData={rangeData}
                                    tempRangeData={tempRangeData}
                                    phRangeData={phRangeData}
                                    ecTdsRangeData={ecTdsRangeData}
                                    doRangeData={doRangeData}
                                    xDomain={xDomain}
                                />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default SensorDashboard;
