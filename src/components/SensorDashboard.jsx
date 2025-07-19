import React, { useEffect, useState, useMemo } from "react";
import mqtt from "mqtt";
import SpectrumBarChart from "./SpectrumBarChart";
import HistoricalTemperatureChart from "./HistoricalTemperatureChart";
import HistoricalMultiBandChart from "./HistoricalMultiBandChart";
import Header from "./Header";
import SensorCard from "./SensorCard";
import { trimOldEntries, normalizeSensorData, filterNoise } from "../utils";
import styles from './SensorDashboard.module.css';

const topic = "azadFarm/sensorData";

const sensorFieldMap = {
    veml7700: ['lux'],
    sht3x: ['temperature', 'humidity'],
    as7341: ['F1','F2','F3','F4','F5','F6','F7','F8','clear','nir'],
    tds: ['tds', 'ec'],
    ph: ['ph']
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
        health: { veml7700: false, as7341: false, sht3x: false, tds: false, ph: false },
    });
    const [dailyData, setDailyData] = useState(() => {
        const stored = localStorage.getItem("dailyData");
        const now = Date.now();
        const initial = stored ? trimOldEntries(JSON.parse(stored), now, 30 * 24 * 60 * 60 * 1000) : [];
        localStorage.setItem("dailyData", JSON.stringify(initial));
        return initial;
    });
    const [timeRange, setTimeRange] = useState(() => {
        return localStorage.getItem('timeRange') || '24h';
    });
    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [xDomain, setXDomain] = useState([Date.now() - 24 * 60 * 60 * 1000, Date.now()]);
    const [startTime, setStartTime] = useState(xDomain[0]);
    const [endTime, setEndTime] = useState(xDomain[1]);

    const rangeMap = useMemo(() => ({
        '6h': 6 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '3days': 3 * 24 * 60 * 60 * 1000,
        '7days': 7 * 24 * 60 * 60 * 1000,
        '1month': 30 * 24 * 60 * 60 * 1000,
    }), []);

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

    const applyFilter = () => {
        const now = Date.now();
        const rangeMs = rangeMap[timeRange] || rangeMap['24h'];
        const start = now - rangeMs;
        const filtered = dailyData
            .filter(d => d.timestamp >= start && d.timestamp <= now)
            .map(d => ({ time: d.timestamp, ...d }));
        setRangeData(filtered);
        setTempRangeData(filtered.map(d => ({
            time: d.time,
            temperature: d.temperature?.value ?? 0,
            humidity: d.humidity?.value ?? 0,
        })));
        setXDomain([start, now]);
        setStartTime(start);
        setEndTime(now);
    };

    useEffect(() => {
        applyFilter();
    }, [timeRange]);

    useEffect(() => {
        localStorage.setItem('timeRange', timeRange);
    }, [timeRange]);

    useEffect(() => {
        if (rangeData.length === 0) {
            applyFilter();
        }
    }, [dailyData]);

    useEffect(() => {
        const client = mqtt.connect(
            import.meta.env.VITE_MQTT_BROKER_URL || "wss://1457f4a458cd4b4e9175ae1816356ce1.s1.eu.hivemq.cloud:8884/mqtt",
            {
                username: import.meta.env.VITE_MQTT_USERNAME || "hivemq.webclient.1752186412216",
                password: import.meta.env.VITE_MQTT_PASSWORD || "5FIH&19,GK8J#lrhax>e",
                protocol: "wss",
            }
        );

        client.on("connect", () => {
            client.subscribe(topic);
        });

        client.on("message", (t, message) => {
            if (t === topic) {
                try {
                    const raw = JSON.parse(message.toString());
                    const normalized = normalizeSensorData(raw);
                    const cleaned = filterNoise(normalized);
                    if (!cleaned) return;
                    setSensorData(cleaned);
                    const timestamp = raw.timestamp ? Date.parse(raw.timestamp) : Date.now();
                    setDailyData(prev => {
                        const updated = trimOldEntries(
                            [...prev, { timestamp, ...cleaned }],
                            timestamp,
                            30 * 24 * 60 * 60 * 1000
                        );
                        localStorage.setItem("dailyData", JSON.stringify(updated));
                        return updated;
                    });
                } catch (e) {
                    console.error("Invalid JSON", e);
                }
            }
        });

        return () => {
            client.end();
        };
    }, []);

    return (
        <div className={styles.dashboard}>
            <div className={styles.section}>
                <h2 className={styles.sectionHeader}>Live Data</h2>
                <div className={styles.sectionBody}>
                    <Header topic={topic} />

                    <div className={styles.sensorGrid}>
                        {Object.entries(sensorData.health).map(([name, ok]) => (
                            <SensorCard
                                key={name}
                                name={name}
                                ok={ok}
                                fields={sensorFieldMap[name] || []}
                                sensorData={sensorData}
                            />
                        ))}
                    </div>

                    <div className={styles.spectrumBarChartWrapper}>
                        <SpectrumBarChart sensorData={sensorData} />
                    </div>
                </div>
            </div>

            <div className={styles.divider}></div>

            <div className={styles.section}>
                <h2 className={styles.sectionHeader}>Reports</h2>
                <div className={styles.sectionBody}>
                    <fieldset className={styles.historyControls}>
                        <legend className={styles.historyLegend}>Historical Range</legend>
                        <div className={styles.filterRow}>
                            <label>
                                Range:
                                <select value={timeRange} onChange={e => setTimeRange(e.target.value)}>
                                    <option value="6h">6h</option>
                                    <option value="12h">12h</option>
                                    <option value="24h">24h</option>
                                    <option value="3days">3 days</option>
                                    <option value="7days">7 days</option>
                                    <option value="1month">1 month</option>
                                </select>
                            </label>
                        </div>
                        <div className={styles.rangeLabel}>
                            {`From: ${formatTime(startTime)} until: ${formatTime(endTime)}`}
                        </div>
                    </fieldset>

                    <h3 className={styles.sectionTitle}>Temperature</h3>
                    <div className={styles.dailyTempChartWrapper}>
                        <HistoricalTemperatureChart data={tempRangeData} xDomain={xDomain} />
                    </div>

                    <h3 className={styles.sectionTitle}>Historical Bands</h3>
                    <div className={styles.multiBandChartWrapper}>
                        <HistoricalMultiBandChart
                            data={rangeData}
                            xDomain={xDomain}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SensorDashboard;
