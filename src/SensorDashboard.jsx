import React, { useEffect, useState } from "react";
import mqtt from "mqtt";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Label
} from "recharts";
import DailyBandChart from "./DailyBandChart";
import DailyTemperatureChart from "./DailyTemperatureChart";
import { trimOldEntries, normalizeSensorData } from "./utils";

const topic = "azadFarm/sensorData";

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
        lux: 0,
    });
    const [dailyData, setDailyData] = useState([]);
    const [selectedBand, setSelectedBand] = useState("F6");

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
                    setSensorData(normalized);
                    const timestamp = Date.now();
                    setDailyData(prev => {
                        const updated = [...prev, { timestamp, ...normalized }];
                        return trimOldEntries(updated, timestamp);
                    });
                } catch (e) {
                    console.error("Invalid JSON", e);
                }
            }
        });

        return () => client.end();
    }, []);

    const spectrumData = [
        { name: "415 nm (F1)", value: sensorData.F1 },
        { name: "445 nm (F2)", value: sensorData.F2 },
        { name: "480 nm (F3)", value: sensorData.F3 },
        { name: "515 nm (F4)", value: sensorData.F4 },
        { name: "555 nm (F5)", value: sensorData.F5 },
        { name: "590 nm (F6)", value: sensorData.F6 },
        { name: "630 nm (F7)", value: sensorData.F7 },
        { name: "680 nm (F8)", value: sensorData.F8 },
        { name: "Clear", value: sensorData.clear },
        { name: "NIR", value: sensorData.nir }
    ];

    const bandChartData = dailyData.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
        intensity: d[selectedBand],
    }));

    const tempChartData = dailyData.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
        temperature: d.temperature,
    }));

    const bandChoices = ["F1","F2","F3","F4","F5","F6","F7","F8","clear","nir"];

    return (
        <div style={{ padding: 20 }}>
            <h1>🌿 AzadFarm - Sensor & Camera Dashboard</h1>

            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={spectrumData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                    <YAxis>
                        <Label value="PPFD" angle={-90} position="insideLeft" />
                    </YAxis>
                    <Tooltip />
                    <Bar dataKey="value" fill="#82ca9d" />
                </BarChart>
            </ResponsiveContainer>

            <div style={{ marginTop: 40 }}>
                <label htmlFor="band-select">Select Band: </label>
                <select id="band-select" value={selectedBand} onChange={e => setSelectedBand(e.target.value)}>
                    {bandChoices.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
            </div>

            <DailyBandChart data={bandChartData} band={selectedBand} />

            <h3 style={{ marginTop: 40 }}>Temperature</h3>
            <DailyTemperatureChart data={tempChartData} />
        </div>
    );
}

export default SensorDashboard;
