// SensorDashboard.jsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import Header from "./Header";
import DeviceTable from "./DeviceTable";
import {transformAggregatedData} from "../utils";
import {useLiveDevices} from "./dashboard/useLiveDevices";
import styles from "./SensorDashboard.module.css";
import idealRangeConfig from "../idealRangeConfig.js";
import HistoricalBlueBandChart from "./HistoricalBlueBandChart";
import HistoricalRedBandChart from "./HistoricalRedBandChart";
import HistoricalClearLuxChart from "./HistoricalClearLuxChart";
import HistoricalPhChart from "./HistoricalPhChart";
import HistoricalEcTdsChart from "./HistoricalEcTdsChart";
import HistoricalTemperatureChart from "./HistoricalTemperatureChart";
import HistoricalDoChart from "./HistoricalDoChart";

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

    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);
    const [doRangeData, setDoRangeData] = useState([]);

    const [xDomain, setXDomain] = useState([now - 6 * 60 * 60 * 1000, now]);
    const [startTime, setStartTime] = useState(xDomain[0]);
    const [endTime, setEndTime] = useState(xDomain[1]);

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    const endTimeRef = useRef(endTime);
    const startTimeRef = useRef(startTime);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

  const systemTopics = deviceData[activeSystem] || {};
  const sensorTopicDevices = systemTopics[SENSOR_TOPIC] || {};

  // Keep selectedDevice valid
    useEffect(() => {
    if (availableBaseIds.length && !availableBaseIds.includes(selectedDevice)) {
      setSelectedDevice(availableBaseIds[0]);
    }
  }, [availableBaseIds, selectedDevice]);

  // mergedDevices and availableBaseIds are provided by useLiveDevices

  // --- History (Report) fetching ---
    const fetchReportData = useCallback(async () => {
    if (!fromDate || !toDate || !selectedDevice) return;
        try {
            const fromIso = new Date(fromDate).toISOString();
            const toIso = new Date(toDate).toISOString();
            const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries.map(d => ({
                time: d.timestamp,
                ...d,
                lux: d.lux?.value ?? 0
            }));
            setRangeData(processed);
            setTempRangeData(processed.map(d => ({
                time: d.time,
                temperature: d.temperature?.value ?? 0,
                humidity: d.humidity?.value ?? 0
            })));
            setPhRangeData(processed.map(d => ({time: d.time, ph: d.ph?.value ?? 0})));
            setEcTdsRangeData(processed.map(d => ({time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0})));
            setDoRangeData(processed.map(d => ({time: d.time, do: d.do?.value ?? 0})));

            const start = Date.parse(fromIso);
            const end = Date.parse(toIso);
            setXDomain([start, end]);
            setStartTime(start);
            setEndTime(end);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [fromDate, toDate, selectedDevice]);

    const fetchNewData = useCallback(async () => {
        try {
            const fromIso = new Date(endTimeRef.current).toISOString();
            const nowDate = new Date();
            const toIso = nowDate.toISOString();
            const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("bad response");
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries
                .map(d => ({time: d.timestamp, ...d, lux: d.lux?.value ?? 0}))
                .filter(d => d.time > endTimeRef.current);

            if (processed.length) {
                setRangeData(prev => [...prev, ...processed]);
                setTempRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0
                }))]);
                setPhRangeData(prev => [...prev, ...processed.map(d => ({time: d.time, ph: d.ph?.value ?? 0}))]);
                setEcTdsRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    ec: d.ec?.value ?? 0,
                    tds: d.tds?.value ?? 0
                }))]);
                setDoRangeData(prev => [...prev, ...processed.map(d => ({time: d.time, do: d.do?.value ?? 0}))]);
            }
            const newEnd = nowDate.getTime();
            setToDate(toLocalInputValue(nowDate));
            setXDomain([startTimeRef.current, newEnd]);
            setEndTime(newEnd);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [selectedDevice]);

    useEffect(() => {
        fetchReportData();
    }, [selectedDevice, fetchReportData]);

    const formatTime = (t) => {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!autoRefresh) return;
        fetchNewData();
        const id = setInterval(fetchNewData, refreshInterval);
        return () => clearInterval(id);
    }, [autoRefresh, refreshInterval, fetchNewData]);


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
            <div className={styles.verticalTabBar}>
                <button className={`${styles.verticalTab} ${activeTab === 'live' ? styles.activeVerticalTab : ''}`}
                        onClick={() => setActiveTab('live')}>Live
                </button>
                <button className={`${styles.verticalTab} ${activeTab === 'report' ? styles.activeVerticalTab : ''}`}
                        onClick={() => setActiveTab('report')}>Report
                </button>
            </div>

      {/* Systems tab bar */}
            <div className={styles.tabBar}>
                {Object.keys(deviceData).map(system => (
                    <button key={system} className={`${styles.tab} ${activeSystem === system ? styles.activeTab : ''}`}
                            onClick={() => setActiveSystem(system)}>{system}</button>
                ))}
            </div>

            {activeTab === 'live' && (
                <div className={styles.section}>
                    <div className={styles.sectionBody}>

            {/* One DeviceTable per topic; keys inside are compositeIds */}
                        {Object.entries(systemTopics).map(([topic, devices]) => (
                            <div key={topic} className={styles.deviceGroup}>
                                <h3 className={styles.topicTitle}>{topic}</h3>
                                <DeviceTable devices={devices}/>
                            </div>
                        ))}

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
                        {(() => {
                            const bandMap = {
                                F1: '415nm', F2: '445nm', F3: '480nm', F4: '515nm',
                                F5: '555nm', F6: '590nm', F7: '630nm', F8: '680nm'
                            };
                            const knownFields = new Set([
                                'temperature', 'humidity', 'lux', 'tds', 'ec', 'ph', 'do',
                                'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'
                            ]);
                            const metaFields = new Set(['timestamp', 'deviceId', 'location']);
                            const topicData = Object.keys(mergedDevices).length ? mergedDevices : {placeholder: sensorData};
                            const sensors = new Set();

                            for (const dev of Object.values(topicData)) {
                                if (Array.isArray(dev.sensors)) {
                                    for (const s of dev.sensors) {
                                        const type = s && (s.type || s.valueType);
                                        if (type) sensors.add(bandMap[type] || type);
                                    }
                                }
                // Skip meta/known fields if any show up
                                for (const key of Object.keys(dev)) {
                                    if (key === 'health' || key === 'sensors') continue;
                                    if (metaFields.has(key)) continue;
                                    if (Array.isArray(dev.sensors) && knownFields.has(key)) continue;
                                    sensors.add(bandMap[key] || key);
                                }
                            }

                            const notes = [];
                            for (const key of sensors) {
                                const cfg = idealRangeConfig[key];
                                if (cfg?.description) notes.push(`${key}: ${cfg.description}`);
                            }
                            return notes.length ? (
                                <div className={styles.noteBlock}>
                                    <div className={styles.noteTitle}>Notes:</div>
                                    <ul>{notes.map((n, i) => (<li key={i}>{n}</li>))}</ul>
                                </div>
                            ) : null;
                        })()}

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
                                <fieldset className={styles.historyControls}>
                                    <legend className={styles.historyLegend}>Historical Range</legend>
                                    <div className={styles.filterRow}>
                                        <label>
                                            From:
                                            <input type="datetime-local" value={fromDate}
                                                   onChange={e => setFromDate(e.target.value)}/>
                                        </label>
                                        <span className={styles.fieldSpacer}>–</span>
                                        <label className={styles.filterLabel}>
                                            To:
                                            <input type="datetime-local" value={toDate}
                                                   onChange={e => setToDate(e.target.value)}/>
                                        </label>
                                        <button type="button" className={styles.nowButton}
                                                onClick={() => setToDate(toLocalInputValue(new Date()))}>Now
                                        </button>
                                        <button type="button" className={styles.applyButton}
                                                onClick={fetchReportData}>Apply
                                        </button>
                                    </div>

                                    <div className={styles.filterRow}>
                                        <label className={styles.filterLabel}>
                                            Device:
                      {/* Options show base deviceIds (G01...), not composite */}
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

                                    <div className={styles.filterRow}>
                                        <label className={styles.filterLabel}>
                                            <input
                                                type="checkbox"
                                                checked={autoRefresh}
                                                onChange={e => setAutoRefresh(e.target.checked)}
                                            />
                                            {' '}Auto Refresh
                                        </label>
                                        <select
                                            className={styles.intervalSelect}
                                            value={refreshInterval}
                                            onChange={e => setRefreshInterval(Number(e.target.value))}
                                            disabled={!autoRefresh}
                                        >
                                            <option value={60000}>1min</option>
                                            <option value={300000}>5min</option>
                                            <option value={600000}>10min</option>
                                            <option value={1800000}>30min</option>
                                            <option value={3600000}>1h</option>
                                        </select>
                                    </div>

                                    <div className={styles.rangeLabel}>
                                        {`From: ${formatTime(startTime)} until: ${formatTime(endTime)}`}
                                    </div>
                                </fieldset>

                                {(showTempHum || showBlue) && (
                                    <div className={styles.historyChartsRow}>
                                        {showTempHum && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>Temperature</h3>
                                                <div className={styles.dailyTempChartWrapper}>
                                                    <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                        {showBlue && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>Blue Bands</h3>
                                                <div className={styles.blueBandChartWrapper}>
                                                    <HistoricalBlueBandChart data={rangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(showRed || showClearLux) && (
                                    <div className={styles.historyChartsRow}>
                                        {showRed && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>Red Bands</h3>
                                                <div className={styles.redBandChartWrapper}>
                                                    <HistoricalRedBandChart data={rangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                        {showClearLux && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>Lux_Clear</h3>
                                                <div className={styles.clearLuxChartWrapper}>
                                                    <HistoricalClearLuxChart data={rangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(showPh || showEcTds) && (
                                    <div className={styles.historyChartsRow}>
                                        {showPh && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>pH</h3>
                                                <div className={styles.phChartWrapper}>
                                                    <HistoricalPhChart data={phRangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                        {showEcTds && (
                                            <div className={styles.historyChartColumn}>
                                                <h3 className={styles.sectionTitle}>EC &amp; TDS</h3>
                                                <div className={styles.ecTdsChartWrapper}>
                                                    <HistoricalEcTdsChart data={ecTdsRangeData} xDomain={xDomain}/>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {showDo && (
                                    <div className={styles.historyChartsRow}>
                                        <div className={styles.historyChartColumn}>
                                            <h3 className={styles.sectionTitle}>Dissolved Oxygen</h3>
                                            <div className={styles.doChartWrapper}>
                                                <HistoricalDoChart data={doRangeData} xDomain={xDomain}/>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default SensorDashboard;
