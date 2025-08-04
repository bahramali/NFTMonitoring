import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import Header from "./Header";
import DeviceTable from "./DeviceTable";
import {filterNoise, normalizeSensorData, transformAggregatedData} from "../utils";
import {useStomp} from "../hooks/useStomp";
import styles from "./SensorDashboard.module.css";
import idealRangeConfig from "../idealRangeConfig.js";
import HistoricalBlueBandChart from "./HistoricalBlueBandChart";
import HistoricalRedBandChart from "./HistoricalRedBandChart";
import HistoricalClearLuxChart from "./HistoricalClearLuxChart";
import HistoricalPhChart from "./HistoricalPhChart";
import HistoricalEcTdsChart from "./HistoricalEcTdsChart";


const SENSOR_TOPIC = "growSensors";
const topics = [SENSOR_TOPIC, "rootImages", "waterOutput", "waterTank"];

function toLocalInputValue(date) {
    const tz = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tz);
    return local.toISOString().slice(0, 16);
}

function SensorDashboard() {
    const [activeSystem, setActiveSystem] = useState("S01");
    const [deviceData, setDeviceData] = useState({});
    const [sensorData, setSensorData] = useState({});
    const [selectedDevice, setSelectedDevice] = useState('G02');

    const now = Date.now();
    const [fromDate, setFromDate] = useState(toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000)));
    const [toDate, setToDate] = useState(toLocalInputValue(new Date(now)));

    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);

    const [xDomain, setXDomain] = useState([now - 6 * 60 * 60 * 1000, now]);
    const [startTime, setStartTime] = useState(xDomain[0]);
    const [endTime, setEndTime] = useState(xDomain[1]);

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60000);

    const endTimeRef = useRef(endTime);
    const startTimeRef = useRef(startTime);

    useEffect(() => {
        endTimeRef.current = endTime
    }, [endTime]);
    useEffect(() => {
        startTimeRef.current = startTime
    }, [startTime]);

    const availableDevices = useMemo(() => {
        const all = deviceData[activeSystem] || {};
        return Object.values(all).flatMap(group => Object.keys(group));
    }, [deviceData, activeSystem]);

    const mergedDevices = useMemo(() => {
        const sysData = deviceData[activeSystem] || {};
        const combined = {};
        for (const topic of Object.keys(sysData)) {
            for (const [deviceId, data] of Object.entries(sysData[topic])) {
                combined[deviceId] = {
                    ...(combined[deviceId] || {}),
                    ...data,
                };
            }
        }
        return combined;
    }, [deviceData, activeSystem]);

    useEffect(() => {
        if (availableDevices.length && !availableDevices.includes(selectedDevice)) {
            setSelectedDevice(availableDevices[0]);
        }
    }, [availableDevices, selectedDevice]);

    const fetchReportData = useCallback(async () => {
        if (!fromDate || !toDate) return;
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
            }
            const newEnd = nowDate.getTime();
            setToDate(toLocalInputValue(nowDate));
            setXDomain([startTimeRef.current, newEnd]);
            setEndTime(newEnd);
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    }, [selectedDevice]);

    const handleStompMessage = useCallback((topic, msg) => {
        console.log("1- before handel stomp message. topic: ", topic, ", Received msg: ", msg);
        let payload = msg;
        if (msg && typeof msg === "object" && "payload" in msg) {
            payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
        }

        const deviceId = payload.deviceId || "unknown";
        const systemId = payload.system || "unknown";

        let data = {};
        if (Array.isArray(payload.sensors)) {
            const normalized = normalizeSensorData(payload);
            const cleaned = topic === SENSOR_TOPIC ? filterNoise(normalized) : normalized;
            if (!cleaned) return;

            data = {
                sensors: payload.sensors,
                health: payload.health || {}
            };

            if (topic === SENSOR_TOPIC) setSensorData(data);
        }

        setDeviceData(prev => {
            const sys = {...(prev[systemId] || {})};
            const topicMap = {...(sys[topic] || {})};
            topicMap[deviceId] = data;
            return {...prev, [systemId]: {...sys, [topic]: topicMap}};
        });
    }, []);

    useEffect(() => {
        fetchReportData();
    }, [selectedDevice]);
    const formatTime = (t) => {
        const d = new Date(t);
        return (
            d.getFullYear().toString() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0')
        );
    };
    useEffect(() => {
        if (!autoRefresh) return;
        fetchNewData();
        const id = setInterval(fetchNewData, refreshInterval);
        return () => clearInterval(id);
    }, [autoRefresh, refreshInterval, fetchNewData]);

    useStomp(topics, handleStompMessage);

    const systemTopics = deviceData[activeSystem] || {};
    const hasSensorTopic = !!systemTopics[SENSOR_TOPIC];
    const hasWaterTank = !!systemTopics["waterTank"];

    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem}/>
            <div className={styles.tabBar}>
                {Object.keys(deviceData).map(system => (
                    <button
                        key={system}
                        className={`${styles.tab} ${activeSystem === system ? styles.activeTab : ''}`}
                        onClick={() => setActiveSystem(system)}
                    >
                        {system}
                    </button>
                ))}
            </div>
            <div className={styles.section}>
                <h2 className={`${styles.sectionHeader} ${styles.liveHeader}`}>Live Data</h2>
                <div className={styles.sectionBody}>
                    {Object.entries(systemTopics).map(([topic, devices]) => (
                        <div key={topic} className={styles.deviceGroup}>
                            <h3 className={styles.topicTitle}>{topic}</h3>
                            <DeviceTable devices={devices}/>
                        </div>
                    ))}

                    {hasSensorTopic && (
                        <>
                            <div className={styles.chartFilterRow}>
                                <label className={styles.filterLabel}>
                                    Device:
                                    <select
                                        className={styles.intervalSelect}
                                        value={selectedDevice}
                                        onChange={e => setSelectedDevice(e.target.value)}
                                    >
                                        {Object.keys(systemTopics[SENSOR_TOPIC] || {}).map(id => (
                                            <option key={id} value={id}>{id}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className={styles.deviceLabel}>{selectedDevice}</div>
                            <div className={styles.spectrumBarChartWrapper}>
                                <SpectrumBarChart
                                    sensorData={
                                        systemTopics[SENSOR_TOPIC]?.[selectedDevice] || sensorData
                                    }
                                />
                            </div>
                        </>
                    )}

                    {(() => {
                        const bandMap = {
                            F1: '415nm',
                            F2: '445nm',
                            F3: '480nm',
                            F4: '515nm',
                            F5: '555nm',
                            F6: '590nm',
                            F7: '630nm',
                            F8: '680nm'
                        };
                        const knownFields = new Set([
                            'temperature', 'humidity', 'lux', 'tds', 'ec', 'ph', 'do',
                            'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'clear', 'nir'
                        ]);
                        const metaFields = new Set(['timestamp', 'deviceId', 'location']);
                        const topicData =
                            Object.keys(mergedDevices).length ? mergedDevices : {placeholder: sensorData};
                        const sensors = new Set();
                        for (const dev of Object.values(topicData)) {
                            if (Array.isArray(dev.sensors)) {
                                for (const s of dev.sensors) {
                                    const type = s && (s.type || s.valueType);
                                    if (type) {
                                        sensors.add(bandMap[type] || type);
                                    }
                                }
                            }
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
                                <ul>
                                    {notes.map((n, i) => (
                                        <li key={i}>{n}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null;
                    })()}
                </div>
            </div>

            <div className={styles.divider}></div>

            <div className={styles.section}>
                <h2 className={`${styles.sectionHeader} ${styles.reportHeader}`}>Reports</h2>
                <div className={styles.sectionBody}>
                    {!hasSensorTopic && !hasWaterTank ? (
                        <div>No reports available for this system.</div>
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
                                        <select
                                            className={styles.intervalSelect}
                                            value={selectedDevice}
                                            onChange={e => setSelectedDevice(e.target.value)}
                                        >
                                            {availableDevices.map(id => (
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

                            {hasSensorTopic && (
                                <>
                                    <div className={styles.historyChartsRow}>
                                        <div className={styles.historyChartColumn}>
                                            <h3 className={styles.sectionTitle}>Temperature</h3>
                                            <div className={styles.dailyTempChartWrapper}>
                                                <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain}/>
                                            </div>
                                        </div>
                                        <div className={styles.historyChartColumn}>
                                            <h3 className={styles.sectionTitle}>Blue Bands</h3>
                                            <div className={styles.blueBandChartWrapper}>
                                                <HistoricalBlueBandChart data={rangeData} xDomain={xDomain}/>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.historyChartsRow}>
                                        <div className={styles.historyChartColumn}>
                                            <h3 className={styles.sectionTitle}>Red Bands</h3>
                                            <div className={styles.redBandChartWrapper}>
                                                <HistoricalRedBandChart data={rangeData} xDomain={xDomain}/>
                                            </div>
                                        </div>
                                        <div className={styles.historyChartColumn}>
                                            <h3 className={styles.sectionTitle}>Lux_Clear</h3>
                                            <div className={styles.clearLuxChartWrapper}>
                                                <HistoricalClearLuxChart data={rangeData} xDomain={xDomain}/>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {hasWaterTank && (
                                <div className={styles.historyChartsRow}>
                                    <div className={styles.historyChartColumn}>
                                        <h3 className={styles.sectionTitle}>pH</h3>
                                        <div className={styles.phChartWrapper}>
                                            <HistoricalPhChart data={phRangeData} xDomain={xDomain}/>
                                        </div>
                                    </div>
                                    <div className={styles.historyChartColumn}>
                                        <h3 className={styles.sectionTitle}>EC &amp; TDS</h3>
                                        <div className={styles.ecTdsChartWrapper}>
                                            <HistoricalEcTdsChart data={ecTdsRangeData} xDomain={xDomain}/>
                                        </div>
                                    </div>
                                    <SpectrumBarChart
                                        sensorData={systemTopics[SENSOR_TOPIC]?.[selectedDevice] || sensorData}/>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SensorDashboard;
