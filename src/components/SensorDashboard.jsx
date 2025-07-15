import React, { useEffect, useState, useMemo } from "react";
import mqtt from "mqtt";
import SpectrumBarChart from "./SpectrumBarChart";
import DailyTemperatureChart from "./DailyTemperatureChart";
import MultiBandChart from "./MultiBandChart";
import Header from "./Header";
import SensorCard from "./SensorCard";
import { trimOldEntries, normalizeSensorData, filterNoise } from "../utils";
import styles from './SensorDashboard.module.css';

const topic = "azadFarm/sensorData";

// Which sensor fields should be shown in each card
const sensorFieldMap = {
    veml7700: ['lux'],
    sht3x: ['temperature', 'humidity'],
    as7341: ['F1','F2','F3','F4','F5','F6','F7','F8','clear','nir']
};

function SensorDashboard() {
    const [sensorData, setSensorData] = useState({
        F1: 0,
        F2: 0,
        F3: 0,
        F4: 0,
        F5: 0,
        F6: 0,
        F7: 0,
        F8: 0,
        clear: 0,
        nir: 0,
        temperature: 0,
        humidity: 0,
        lux: 0,
        health: { veml7700: true, as7341: true, sht3x: true },
    });
    const [dailyData, setDailyData] = useState(() => {
        const stored = localStorage.getItem("dailyData");
        const now = Date.now();
        const initial = stored ? trimOldEntries(JSON.parse(stored), now) : [];
        localStorage.setItem("dailyData", JSON.stringify(initial));
        return initial;
    });
    const [filterStart, setFilterStart] = useState("00:00");
    const [filterEnd, setFilterEnd] = useState("23:59");
    const [rangeData, setRangeData] = useState([]);
    const [tempRangeData, setTempRangeData] = useState([]);
    const [xDomain, setXDomain] = useState([0, 23]);
    const [yMin, setYMin] = useState("");
    const [yMax, setYMax] = useState("");

    const yDomain = useMemo(
        () => [
            yMin === '' ? 'auto' : Number(yMin),
            yMax === '' ? 'auto' : Number(yMax)
        ],
        [yMin, yMax]
    );

    const applyFilter = () => {
        const startHour = parseInt(filterStart.split(":")[0], 10);
        const endHour = parseInt(filterEnd.split(":")[0], 10);
        const filtered = dailyData
            .filter(d => {
                const h = new Date(d.timestamp).getHours();
                return startHour <= endHour
                    ? h >= startHour && h <= endHour
                    : h >= startHour || h <= endHour;
            })
            .map(d => ({
                time: new Date(d.timestamp).getHours(),
                ...d,
            }));
        setRangeData(filtered);
        setTempRangeData(filtered.map(d => ({
            time: d.time,
            temperature: d.temperature,
            humidity: d.humidity,
        })));
        setXDomain([startHour, endHour]);
    };

    useEffect(() => {
        applyFilter();
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
                        const updated = trimOldEntries([...prev, { timestamp, ...cleaned }], timestamp);
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

    // Render latest spectrum readings with SpectrumBarChart

    return (
        <div className={styles.dashboard}>
            <Header topic={topic} />

            <div className={styles.sensorGrid}>
                {Object.entries(sensorData.health).map(([name, ok]) => (
                    <SensorCard key={name} name={name} ok={ok}>
                        {sensorFieldMap[name]?.map(field => (
                            <div key={field}>{field}: {Number(sensorData[field]).toFixed ? Number(sensorData[field]).toFixed(1) : sensorData[field]}</div>
                        ))}
                    </SensorCard>
                ))}
            </div>

            <SpectrumBarChart sensorData={sensorData} />

            <h3 className={styles.sectionTitle}>Temperature</h3>
            <DailyTemperatureChart data={tempRangeData} />

            <h3 className={styles.sectionTitle}>Historical Bands</h3>
            <div className={styles.filterRow}>
                <label>
                    Start:
                    <input type="time" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                </label>
                <label className={styles.filterLabel}>
                    End:
                    <input type="time" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
                </label>
                <label className={styles.filterLabel}>
                    Y min:
                    <input type="number" value={yMin} onChange={e => setYMin(e.target.value)} className={styles.numberInput} />
                </label>
                <label className={styles.filterLabel}>
                    Y max:
                    <input type="number" value={yMax} onChange={e => setYMax(e.target.value)} className={styles.numberInput} />
                </label>
                <button className={styles.applyButton} onClick={applyFilter}>Apply</button>
            </div>
            <MultiBandChart
                data={rangeData}
                xDomain={xDomain}
                yDomain={yDomain}
            />
        </div>
    );
}

export default SensorDashboard;
