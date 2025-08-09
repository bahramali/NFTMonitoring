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

const SENSOR_TOPIC = "growSensors";
const topics = [SENSOR_TOPIC, "rootImages", "waterOutput", "waterTank"];

// Format date for <input type="datetime-local">
function toLocalInputValue(date) {
    const tz = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tz);
    return local.toISOString().slice(0, 16);
}

function SensorDashboard() {
    const [activeSystem, setActiveSystem] = useState("S01");
    const {deviceData, sensorData, availableBaseIds, mergedDevices} = useLiveDevices(topics, activeSystem);
  // selectedDevice is the *base* deviceId (e.g., G01) used for history API
    const [selectedDevice, setSelectedDevice] = useState("G02");
    const [activeTab, setActiveTab] = useState("live");

    const now = Date.now();
    const [fromDate, setFromDate] = useState(toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000)));
    const [toDate, setToDate] = useState(toLocalInputValue(new Date(now)));

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    const {
        rangeData,
        tempRangeData,
        phRangeData,
        ecTdsRangeData,
        doRangeData,
        xDomain,
        startTime,
        endTime,
        fetchReportData
    } = useHistory(selectedDevice, fromDate, toDate, autoRefresh, refreshInterval);

  const systemTopics = deviceData[activeSystem] || {};
  const sensorTopicDevices = systemTopics[SENSOR_TOPIC] || {};

  // Keep selectedDevice valid
    useEffect(() => {
    if (availableBaseIds.length && !availableBaseIds.includes(selectedDevice)) {
      setSelectedDevice(availableBaseIds[0]);
    }
  }, [availableBaseIds, selectedDevice]);

  // mergedDevices and availableBaseIds are provided by useLiveDevices


    const formatTime = (t) => {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };



  // Figure out which report sections to show based on selected device's sensor types
    const sensorTypesForSelected = useMemo(() => {
    // Find any one composite device that matches selected baseId
    const match = Object.values(sensorTopicDevices).find(d => d?.deviceId === selectedDevice);
    const sensors = match?.sensors || [];
        return sensors.map(s => s.type || s.valueType);
  }, [sensorTopicDevices, selectedDevice]);

    const showTempHum = sensorTypesForSelected.includes('temperature') || sensorTypesForSelected.includes('humidity');
    const showBlue = sensorTypesForSelected.includes('colorSpectrum') ||
        ['F1', 'F2', 'F3', 'F4', '415nm', '445nm', '480nm', '515nm'].some(t => sensorTypesForSelected.includes(t));
    const showRed = sensorTypesForSelected.includes('colorSpectrum') ||
        ['F5', 'F6', 'F7', 'F8', '555nm', '590nm', '630nm', '680nm', 'nir'].some(t => sensorTypesForSelected.includes(t));
    const showClearLux = sensorTypesForSelected.includes('light') || sensorTypesForSelected.includes('lux') ||
        sensorTypesForSelected.includes('clear') || sensorTypesForSelected.includes('colorSpectrum');
    const showPh = sensorTypesForSelected.includes('ph');
    const showEcTds = sensorTypesForSelected.includes('ec') || sensorTypesForSelected.includes('tds');
    const showDo = sensorTypesForSelected.includes('do') || sensorTypesForSelected.includes('dissolvedOxygen');
    const showAnyReport = showTempHum || showBlue || showRed || showClearLux || showPh || showEcTds || showDo;

    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem}/>

      {/* Vertical tab bar */}
            <VerticalTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Systems tab bar */}
            <SystemTabs systems={Object.keys(deviceData)} activeSystem={activeSystem} onChange={setActiveSystem} />

            {activeTab === 'live' && (
                <div className={styles.section}>
                    <div className={styles.sectionBody}>

            {/* One DeviceTable per topic; keys inside are compositeIds */}
                        <TopicSection systemTopics={systemTopics} />

            {/* Live chart for the last received SENSOR_TOPIC message */}
            {Object.keys(sensorTopicDevices).length > 0 && (
                            <>
                                <div className={styles.chartFilterRow}>
                                    <label className={styles.filterLabel}>
                                        Device:
                                        <select
                                            className={styles.intervalSelect}
                                            value={selectedDevice}
                                            onChange={e => setSelectedDevice(e.target.value)}
                                        >
                      {availableBaseIds.map(id => (
                                                <option key={id} value={id}>{id}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className={styles.deviceLabel}>{selectedDevice}</div>

                                <div className={styles.spectrumBarChartWrapper}>
                  {/* Use flattened/normalized data only */}
                                    <SpectrumBarChart sensorData={sensorData}/>
                                </div>
                            </>
                        )}

            {/* Notes block built from mergedDevices */}
                        <NotesBlock mergedDevices={mergedDevices} />

                    </div>
                </div>
            )}

            {activeTab === 'report' && (
                <div className={styles.section}>
                    <div className={styles.sectionBody}>
                        {!showAnyReport ? (
                            <div>No reports available for this device.</div>
                        ) : (
                            <>
                                <ReportControls
                                    fromDate={fromDate}
                                    toDate={toDate}
                                    onFromDateChange={e => setFromDate(e.target.value)}
                                    onToDateChange={e => setToDate(e.target.value)}
                                    onNow={() => setToDate(toLocalInputValue(new Date()))}
                                    onApply={fetchReportData}
                                    selectedDevice={selectedDevice}
                                    availableBaseIds={availableBaseIds}
                                    onDeviceChange={e => setSelectedDevice(e.target.value)}
                                    autoRefresh={autoRefresh}
                                    onAutoRefreshChange={e => setAutoRefresh(e.target.checked)}
                                    refreshInterval={refreshInterval}
                                    onRefreshIntervalChange={e => setRefreshInterval(Number(e.target.value))}
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
