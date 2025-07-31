import React, { useEffect, useState, useCallback } from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import HistoricalTemperatureChart from "./HistoricalTemperatureChart";
import HistoricalBlueBandChart from "./HistoricalBlueBandChart";
import HistoricalRedBandChart from "./HistoricalRedBandChart";
import HistoricalClearLuxChart from "./HistoricalClearLuxChart";
import HistoricalPhChart from "./HistoricalPhChart";
import HistoricalEcTdsChart from "./HistoricalEcTdsChart";
import Header from "./Header";
import DeviceTable from "./DeviceTable";
import { transformAggregatedData, normalizeSensorData, filterNoise } from "../utils";
import idealRangeConfig from "../idealRangeConfig";
import { useStomp } from '../hooks/useStomp';
import styles from './SensorDashboard.module.css';

function toLocalInputValue(date) {
    const tz = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tz);
    return local.toISOString().slice(0, 16);
}

const sensorTopic = "growSensors";
const topics = [sensorTopic, "rootImages", "waterOutput", "waterTank"];

const sensorFieldMap = {
    veml7700: ["lux"],
    sht3x: ["temperature", "humidity"],
    as7341: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "clear", "nir"],
    tds: ["tds", "ec"],
    ph: ["ph"],
};


function SensorDashboard() {
    const [sensorData, setSensorData] = useState({
        F1: 0, F2: 0, F3: 0, F4: 0, F5: 0,
        F6: 0, F7: 0, F8: 0, clear: 0, nir: 0,
        temperature: { value: 0, unit: "°C" },
        humidity: { value: 0, unit: "%" },
        lux: { value: 0, unit: "lux" },
        tds: { value: 0, unit: "ppm" },
        ec: { value: 0, unit: "mS/cm" },
        ph: { value: 0, unit: '' },
        health: {},
    });
    useEffect(() => {
        console.log('📊 sensorData state changed:', sensorData);
    }, [sensorData]);
    const [activeTopic, setActiveTopic] = useState(sensorTopic);
    const [deviceData, setDeviceData] = useState({});
    const toLocalInputValue = (ts) => {
        const d = new Date(ts);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0,16);
    };

    const now = Date.now();
    const defaultFrom = toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000));
    const defaultTo = toLocalInputValue(new Date(now));
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate, setToDate] = useState(defaultTo);
    const [selectedDevice, setSelectedDevice] = useState('esp32-01');
    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);
    const [xDomain, setXDomain] = useState([Date.now() - 6 * 60 * 60 * 1000, Date.now()]);
    const [startTime, setStartTime] = useState(xDomain[0]);
    const [endTime, setEndTime] = useState(xDomain[1]);

    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(60 * 1000);
    const endTimeRef = React.useRef(endTime);
    const startTimeRef = React.useRef(startTime);

    useEffect(() => {
        endTimeRef.current = endTime;
    }, [endTime]);

    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

    useEffect(() => {
        const ids = Object.keys(deviceData[activeTopic] || {}).filter(id => id !== 'placeholder');
        if (ids.length && !ids.includes(selectedDevice)) {
            setSelectedDevice(ids[0]);
        }
    }, [deviceData, selectedDevice, activeTopic]);

    const fetchReportData = useCallback(async () => {
        if (!fromDate || !toDate) return;
        const fromIso = new Date(fromDate).toISOString();
        const toIso = new Date(toDate).toISOString();
        const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('bad response');
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries.map(d => ({
                time: d.timestamp,
                ...d,
                lux: d.lux?.value ?? 0,
            }));
            setRangeData(processed);
            setTempRangeData(processed.map(d => ({
                time: d.time,
                temperature: d.temperature?.value ?? 0,
                humidity: d.humidity?.value ?? 0,
            })));
            setPhRangeData(processed.map(d => ({
                time: d.time,
                ph: d.ph?.value ?? 0,
            })));
            setEcTdsRangeData(processed.map(d => ({
                time: d.time,
                ec: d.ec?.value ?? 0,
                tds: d.tds?.value ?? 0,
            })));
            const start = Date.parse(fromIso);
            const end = Date.parse(toIso);
            setXDomain([start, end]);
            setStartTime(start);
            setEndTime(end);
        } catch (e) {
            console.error('Failed to fetch history', e);
        }
    }, [fromDate, toDate, selectedDevice]);

    const fetchNewData = useCallback(async () => {
        const fromIso = new Date(endTimeRef.current).toISOString();
        const nowDate = new Date();
        const toIso = nowDate.toISOString();
        const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('bad response');
            const json = await res.json();
            const entries = transformAggregatedData(json);
            const processed = entries.map(d => ({
                time: d.timestamp,
                ...d,
                lux: d.lux?.value ?? 0,
            })).filter(d => d.time > endTimeRef.current);
            if (processed.length) {
                setRangeData(prev => [...prev, ...processed]);
                setTempRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    temperature: d.temperature?.value ?? 0,
                    humidity: d.humidity?.value ?? 0,
                }))]);
                setPhRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    ph: d.ph?.value ?? 0,
                }))]);
                setEcTdsRangeData(prev => [...prev, ...processed.map(d => ({
                    time: d.time,
                    ec: d.ec?.value ?? 0,
                    tds: d.tds?.value ?? 0,
                }))]);
            }
            const newEnd = nowDate.getTime();
            setToDate(toLocalInputValue(nowDate));
            setXDomain([startTimeRef.current, newEnd]);
            setEndTime(newEnd);
        } catch (e) {
            console.error('Failed to fetch history', e);
        }
    }, [selectedDevice]);

    const handleStompMessage = useCallback((topic, msg) => {
        console.log('📨 handleStompMessage topic:', topic, 'msg:', msg);
        let payload = msg;
        if (msg && typeof msg === 'object' && 'payload' in msg) {
            payload =
                typeof msg.payload === 'string'
                    ? JSON.parse(msg.payload)
                    : msg.payload;
        }
        const deviceId = payload.deviceId || msg.deviceId || 'unknown';
        let data = payload;
        if (topic === sensorTopic || topic === 'waterTank') {
            const norm = normalizeSensorData(payload);
            console.log('🔄 normalized sensor message:', norm);
            if (topic === sensorTopic) {
                const cleaned = filterNoise(norm);
                if (!cleaned) {
                    console.log('🛑 message filtered out as noise', norm);
                    return;
                }
                data = cleaned;
                console.log('💾 updating sensorData state with:', data);
                setSensorData(data);
            } else {
                data = { ...norm, sensors: payload.sensors };
            }
        }
        setDeviceData(prev => {
            const t = { ...(prev[topic] || {}) };
            t[deviceId] = data;
            console.log('📥 setDeviceData for', topic, deviceId, data);
            return { ...prev, [topic]: t };
        });
    }, []);

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
        fetchReportData();
    }, [selectedDevice]);

    useEffect(() => {
        if (!autoRefresh) return;
        fetchNewData();
        const id = setInterval(fetchNewData, refreshInterval);
        return () => clearInterval(id);
    }, [autoRefresh, refreshInterval, fetchNewData]);

    useStomp(topics, handleStompMessage);

    const deviceIds = Object.keys(deviceData[activeTopic] || {}).filter(id => id !== 'placeholder');
    const availableDevices = deviceIds.length ? deviceIds : [selectedDevice];

    return (
        <div className={styles.dashboard}>
            <Header topic={activeTopic} />
            <div className={styles.tabBar}>
                {topics.map(t => (
                    <button
                        key={t}
                        className={`${styles.tab} ${activeTopic === t ? styles.activeTab : ''}`}
                        onClick={() => setActiveTopic(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>
            <div className={styles.section}>
                <h2 className={`${styles.sectionHeader} ${styles.liveHeader}`}>Live Data</h2>
                <div className={styles.sectionBody}>

                    <DeviceTable
                        devices={
                            deviceData[activeTopic] ||
                            (activeTopic === sensorTopic ? { placeholder: sensorData } : {})
                        }
                    />

                    {activeTopic === sensorTopic && (
                        <div className={styles.spectrumBarChartWrapper}>
                            <div className={styles.spectrumHeaderRow}>
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
                                <div className={styles.deviceLabel}>{selectedDevice}</div>
                            </div>
                            <SpectrumBarChart
                                sensorData={
                                    deviceData[sensorTopic]?.[selectedDevice] || sensorData
                                }
                            />
                        </div>
                    )}

                    {(() => {
                        const notes = new Set();
                        const topicData = deviceData[activeTopic] || {};
                        if (activeTopic === sensorTopic && Object.keys(topicData).length === 0) {
                            for (const key in sensorData) {
                                if (key === 'health') continue;
                                const cfg = idealRangeConfig[key];
                                if (cfg?.description) notes.add(`${key}: ${cfg.description}`);
                            }
                        } else {
                            for (const dev of Object.values(topicData)) {
                                for (const key in dev) {
                                    const cfg = idealRangeConfig[key];
                                    if (cfg?.description) notes.add(`${key}: ${cfg.description}`);
                                }
                            }
                        }
                        return notes.size ? (
                            <div className={styles.noteBlock}>
                                <div className={styles.noteTitle}>Notes:</div>
                                <ul>
                                    {[...notes].map((n, i) => (
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
                    {activeTopic !== sensorTopic && activeTopic !== 'waterTank' ? (
                        <div>No reports available for this topic.</div>
                    ) : (
                    <>
                    <fieldset className={styles.historyControls}>
                        <legend className={styles.historyLegend}>Historical Range</legend>
                        <div className={styles.filterRow}>
                            <label>
                                From:
                                <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                            </label>
                            <span className={styles.fieldSpacer}>–</span>
                            <label className={styles.filterLabel}>
                                To:
                                <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)} />
                            </label>
                            <button type="button" className={styles.nowButton} onClick={() => setToDate(toLocalInputValue(new Date()))}>Now</button>
                        <button type="button" className={styles.applyButton} onClick={fetchReportData}>Apply</button>
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

                    {activeTopic === sensorTopic && (
                        <>
                        <div className={styles.historyChartsRow}>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>Temperature</h3>
                                <div className={styles.dailyTempChartWrapper}>
                                    <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain} />
                                </div>
                            </div>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>Blue Bands</h3>
                                <div className={styles.blueBandChartWrapper}>
                                    <HistoricalBlueBandChart data={rangeData} xDomain={xDomain} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.historyChartsRow}>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>Red Bands</h3>
                                <div className={styles.redBandChartWrapper}>
                                    <HistoricalRedBandChart data={rangeData} xDomain={xDomain} />
                                </div>
                            </div>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>Lux_Clear</h3>
                                <div className={styles.clearLuxChartWrapper}>
                                    <HistoricalClearLuxChart data={rangeData} xDomain={xDomain} />
                                </div>
                            </div>
                        </div>
                        </>
                    )}

                    {activeTopic === 'waterTank' && (
                        <div className={styles.historyChartsRow}>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>pH</h3>
                                <div className={styles.phChartWrapper}>
                                    <HistoricalPhChart data={phRangeData} xDomain={xDomain} />
                                </div>
                            </div>
                            <div className={styles.historyChartColumn}>
                                <h3 className={styles.sectionTitle}>EC &amp; TDS</h3>
                                <div className={styles.ecTdsChartWrapper}>
                                    <HistoricalEcTdsChart data={ecTdsRangeData} xDomain={xDomain} />
                                </div>
                            </div>
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
