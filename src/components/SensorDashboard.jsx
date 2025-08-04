import React, {useCallback, useEffect, useMemo, useState} from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import Header from "./Header";
import DeviceTable from "./DeviceTable";
import {filterNoise, normalizeSensorData, transformAggregatedData} from "../utils";
import {useStomp} from "../hooks/useStomp";
import styles from "./SensorDashboard.module.css";

function toLocalInputValue(date) {
    const tz = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tz);
    return local.toISOString().slice(0, 16);
}

const sensorTopic = "growSensors";
const topics = [sensorTopic, "rootImages", "waterOutput", "waterTank"];

function SensorDashboard() {
  const [activeSystem, setActiveSystem] = useState("S01");
    const [deviceData, setDeviceData] = useState({});
  const [sensorData, setSensorData] = useState({});
  const [selectedDevice, setSelectedDevice] = useState("esp32-01");

    const now = Date.now();
    const defaultFrom = toLocalInputValue(new Date(now - 6 * 60 * 60 * 1000));
    const defaultTo = toLocalInputValue(new Date(now));
    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate, setToDate] = useState(defaultTo);

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

  useEffect(() => { endTimeRef.current = endTime }, [endTime]);
  useEffect(() => { startTimeRef.current = startTime }, [startTime]);

  const availableDevices = useMemo(() => {
    const all = deviceData[activeSystem] || {};
    const devices = new Set();
    Object.values(all).forEach(group => {
      Object.keys(group).forEach(id => devices.add(id));
    });
    return [...devices];
    }, [deviceData, activeSystem]);


    useEffect(() => {
    if (availableDevices.length && !availableDevices.includes(selectedDevice)) {
      setSelectedDevice(availableDevices[0]);
        }
  }, [availableDevices, selectedDevice]);

    const fetchReportData = useCallback(async () => {
        if (!fromDate || !toDate) return;
        const fromIso = new Date(fromDate).toISOString();
        const toIso = new Date(toDate).toISOString();
        const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
        try {
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
      setTempRangeData(processed.map(d => ({ time: d.time, temperature: d.temperature?.value ?? 0, humidity: d.humidity?.value ?? 0 })));
      setPhRangeData(processed.map(d => ({ time: d.time, ph: d.ph?.value ?? 0 })));
      setEcTdsRangeData(processed.map(d => ({ time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0 })));

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
        const fromIso = new Date(endTimeRef.current).toISOString();
        const nowDate = new Date();
        const toIso = nowDate.toISOString();
        const url = `https://api.hydroleaf.se/api/sensors/history/aggregated?espId=${selectedDevice}&from=${fromIso}&to=${toIso}`;
        try {
            const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");
            const json = await res.json();
            const entries = transformAggregatedData(json);
      const processed = entries
        .map(d => ({ time: d.timestamp, ...d, lux: d.lux?.value ?? 0 }))
        .filter(d => d.time > endTimeRef.current);

            if (processed.length) {
                setRangeData(prev => [...prev, ...processed]);
        setTempRangeData(prev => [...prev, ...processed.map(d => ({ time: d.time, temperature: d.temperature?.value ?? 0, humidity: d.humidity?.value ?? 0 }))]);
        setPhRangeData(prev => [...prev, ...processed.map(d => ({ time: d.time, ph: d.ph?.value ?? 0 }))]);
        setEcTdsRangeData(prev => [...prev, ...processed.map(d => ({ time: d.time, ec: d.ec?.value ?? 0, tds: d.tds?.value ?? 0 }))]);
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
        let payload = msg;
    if (msg && typeof msg === "object" && "payload" in msg) {
      payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
        }

    const deviceId = payload.deviceId || "unknown";
    const systemId = payload.system || "unknown";
        let data = payload;

    if (topic === sensorTopic || topic === "waterTank") {
      const normalized = normalizeSensorData(payload);
            if (topic === sensorTopic) {
        const cleaned = filterNoise(normalized);
        if (!cleaned) return;
                data = cleaned;
                setSensorData(data);
            } else {
        data = { ...normalized, sensors: payload.sensors };
            }
        }
        setDeviceData(prev => {
            const sys = { ...(prev[systemId] || {}) };
      const topicMap = { ...(sys[topic] || {}) };
      topicMap[deviceId] = { ...topicMap[deviceId], ...data };
      return { ...prev, [systemId]: { ...sys, [topic]: topicMap } };
        });
    }, []);

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

    const systemTopics = deviceData[activeSystem] || {};
    const hasSensorTopic = !!systemTopics[sensorTopic];
  const hasWaterTank = !!systemTopics["waterTank"];

    return (
        <div className={styles.dashboard}>
            <Header system={activeSystem} />
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
                            <DeviceTable devices={devices} />
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
                                        {availableDevices.map(id => (
                                            <option key={id} value={id}>{id}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className={styles.deviceLabel}>{selectedDevice}</div>
                            <div className={styles.spectrumBarChartWrapper}>
                <SpectrumBarChart sensorData={systemTopics[sensorTopic]?.[selectedDevice] || sensorData} />
                        </div>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SensorDashboard;
