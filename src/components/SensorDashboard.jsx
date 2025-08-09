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
    const {deviceData, sensorData, availableBaseIds, mergedDevices} = useLiveDevices(topics, activeSystem);

    // base deviceId (e.g., G01) used for history API calls
    const [selectedDevice, setSelectedDevice] = useState("G02");
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
    setLists,
  } = useFilters();

    // History data for the selected device
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
  } = useHistory(selectedDevice, fromDate, toDate, autoRefresh, refreshInterval);

    // Topics for the currently active system
  const systemTopics = deviceData[activeSystem] || {};
  const sensorTopicDevices = systemTopics[SENSOR_TOPIC] || {};

  // ──────────────────────────────
    // 1) Build metadata: baseDeviceId -> { system, layer }
    const deviceMeta = useMemo(() => {
        const map = {};
        for (const [sysId, topicsObj] of Object.entries(deviceData || {})) {
            for (const devs of Object.values(topicsObj || {})) {
        for (const [, payload] of Object.entries(devs || {})) {
                    const baseId = payload?.deviceId;
                    if (!baseId) continue;
                    const layer = payload?.location?.layer || payload?.location || null;
                    map[baseId] = { system: sysId, layer };
                }
            }
        }
        return map;
    }, [deviceData]);

    // 2) Populate sidebar lists (Device / Layer / System)
    useEffect(() => {
        const devices = Object.keys(deviceMeta);
        const layers = Array.from(
            new Set(Object.values(deviceMeta).map((m) => m.layer).filter(Boolean))
        );
        const systems = Object.keys(deviceData || {});
        setLists({ devices, layers, systems });
    }, [deviceMeta, deviceData, setLists]);

    // 3) Keep activeSystem in sync with the System filter
    useEffect(() => {
        if (sysFilter !== ALL && sysFilter !== activeSystem) {
            setActiveSystem(sysFilter);
        }
    }, [sysFilter, activeSystem]);

    // 4) Filter available device IDs based on all active filters
    const filteredBaseIds = useMemo(() => {
        return availableBaseIds.filter((id) => {
            const meta = deviceMeta[id] || {};
            const okDev = devFilter === ALL || id === devFilter;
            const okLay = layerFilter === ALL || meta.layer === layerFilter;
            const okSys = sysFilter === ALL || meta.system === sysFilter;
            return okDev && okLay && okSys;
        });
    }, [availableBaseIds, deviceMeta, devFilter, layerFilter, sysFilter]);

    // 5) Filter topics for live tables based on filtered devices
    const filteredSystemTopics = useMemo(() => {
        const out = {};
        for (const [topic, devs] of Object.entries(systemTopics || {})) {
            out[topic] = Object.fromEntries(
                Object.entries(devs || {}).filter(([, payload]) =>
                    filteredBaseIds.includes(payload?.deviceId)
                )
            );
        }
        return out;
    }, [systemTopics, filteredBaseIds]);

    // 6) Ensure selectedDevice remains valid after filters change
    useEffect(() => {
        if (filteredBaseIds.length && !filteredBaseIds.includes(selectedDevice)) {
            setSelectedDevice(filteredBaseIds[0]);
        }
    }, [filteredBaseIds, selectedDevice]);

    // 7) Determine which report sections to display based on selected device's sensor types
    const sensorTypesForSelected = useMemo(() => {
        const match = Object.values(sensorTopicDevices).find(
            (d) => d?.deviceId === selectedDevice
        );
        const sensors = match?.sensors || [];
        return sensors.map((s) => s.type || s.valueType);
    }, [sensorTopicDevices, selectedDevice]);

    const showTempHum =
        sensorTypesForSelected.includes("temperature") ||
        sensorTypesForSelected.includes("humidity");
    const showBlue =
        sensorTypesForSelected.includes("colorSpectrum") ||
        ["F1", "F2", "F3", "F4", "415nm", "445nm", "480nm", "515nm"].some((t) =>
            sensorTypesForSelected.includes(t)
        );
    const showRed =
        sensorTypesForSelected.includes("colorSpectrum") ||
        ["F5", "F6", "F7", "F8", "555nm", "590nm", "630nm", "680nm", "nir"].some(
            (t) => sensorTypesForSelected.includes(t)
        );
    const showClearLux =
        sensorTypesForSelected.includes("light") ||
        sensorTypesForSelected.includes("lux") ||
        sensorTypesForSelected.includes("clear") ||
        sensorTypesForSelected.includes("colorSpectrum");
    const showPh = sensorTypesForSelected.includes("ph");
    const showEcTds =
        sensorTypesForSelected.includes("ec") ||
        sensorTypesForSelected.includes("tds");
    const showDo =
        sensorTypesForSelected.includes("do") ||
        sensorTypesForSelected.includes("dissolvedOxygen");
    const showAnyReport = showTempHum || showBlue || showRed || showClearLux || showPh || showEcTds || showDo;


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
                                            {filteredBaseIds.map((id) => (
                                                <option key={id} value={id}>{id}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className={styles.deviceLabel}>{selectedDevice}</div>

                                {filteredBaseIds.includes(selectedDevice) && (
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
                                    availableBaseIds={filteredBaseIds} // filtered list
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
                                    showBlue={showBlue}
                                    showRed={showRed}
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
