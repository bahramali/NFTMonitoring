import React, { useEffect, useState, useMemo } from "react";
import SpectrumBarChart from "./SpectrumBarChart";
import HistoricalTemperatureChart from "./HistoricalTemperatureChart";
import HistoricalBlueBandChart from "./HistoricalBlueBandChart";
import HistoricalRedBandChart from "./HistoricalRedBandChart";
import HistoricalClearLuxChart from "./HistoricalClearLuxChart";
import HistoricalPhChart from "./HistoricalPhChart";
import HistoricalEcTdsChart from "./HistoricalEcTdsChart";
import Header from "./Header";
import SensorCard from "./SensorCard";
import { trimOldEntries, normalizeSensorData, filterNoise, parseSensorJson } from "../utils";
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
    const [phRangeData, setPhRangeData] = useState([]);
    const [ecTdsRangeData, setEcTdsRangeData] = useState([]);
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
            .map(d => ({
                time: d.timestamp,
                ...d,
                lux: d.lux?.value ?? 0,
            }));
        setRangeData(filtered);
        setTempRangeData(filtered.map(d => ({
            time: d.time,
            temperature: d.temperature?.value ?? 0,
            humidity: d.humidity?.value ?? 0,
        })));
        setPhRangeData(filtered.map(d => ({
            time: d.time,
            ph: d.ph?.value ?? 0,
        })));
        setEcTdsRangeData(filtered.map(d => ({
            time: d.time,
            ec: d.ec?.value ?? 0,
            tds: d.tds?.value ?? 0,
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
        let wsUrl = import.meta.env.VITE_WS_URL || "ws://16.170.206.232:8080/ws";
        // If the page is served over HTTPS we must also use a secure WebSocket
        if (location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
            wsUrl = 'wss://' + wsUrl.slice(5);
        }

        let socket;
        let buffer = "";

        const buildFrame = (command, headers = {}, body = "") => {
            let frame = command + "\n";
            for (const [k, v] of Object.entries(headers)) {
                frame += `${k}:${v}\n`;
            }
            return frame + "\n" + body + "\0";
        };

        const handleFrame = (frame) => {
            if (frame.command === "CONNECTED") {
                socket.send(
                    buildFrame("SUBSCRIBE", { id: "sub-0", destination: `/topic/${topic}`, ack: "auto" })
                );
                return;
            }
            if (frame.command === "MESSAGE") {
                try {
                    const raw = parseSensorJson(frame.body);
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
                    console.error("Invalid STOMP message", e);
                }
            }
        };

        const processData = (data) => {
            buffer += data;
            while (true) {
                const nullIdx = buffer.indexOf("\0");
                if (nullIdx === -1) break;
                const frameStr = buffer.slice(0, nullIdx);
                buffer = buffer.slice(nullIdx + 1);
                const idx = frameStr.indexOf("\n\n");
                if (idx === -1) continue;
                const headerLines = frameStr.slice(0, idx).split("\n");
                const command = headerLines.shift();
                const headers = {};
                for (const line of headerLines) {
                    if (!line) continue;
                    const i = line.index(":");
                    if (i > 0) headers[line.slice(0, i)] = line.slice(i + 1);
                }
                const body = frameStr.slice(idx + 2);
                handleFrame({ command, headers, body });
            }
        };

        socket = new WebSocket(wsUrl);

        socket.addEventListener("open", () => {
            socket.send(
                buildFrame("CONNECT", {
                    "accept-version": "1.2",
                    host: location.hostname,
                    "heart-beat": "0,0",
                })
            );
        });

        socket.addEventListener("message", (event) => {
            processData(event.data);
        });

        socket.addEventListener("error", (e) => {
            console.error("WebSocket error", e);
        });

        socket.addEventListener("close", () => {
            console.warn("WebSocket closed");
        });

        return () => {
            if (socket) socket.close();
        };
    }, []);

    return (
        <div className={styles.dashboard}>
            <Header topic={topic} />
            <div className={styles.section}>
                <h2 className={`${styles.sectionHeader} ${styles.liveHeader}`}>Live Data</h2>
                <div className={styles.sectionBody}>
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
                <h2 className={`${styles.sectionHeader} ${styles.reportHeader}`}>Reports</h2>
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
                </div>
            </div>
        </div>
    );
}

export default SensorDashboard;
