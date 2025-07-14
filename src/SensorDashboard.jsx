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

const topic = "azadFarm/sensorData";


function SensorDashboard() {
    const [sensorData, setSensorData] = useState({});

    useEffect(() => {
        const client = mqtt.connect("wss://1457f4a458cd4b4e9175ae1816356ce1.s1.eu.hivemq.cloud:8884/mqtt", {
            username: "hivemq.webclient.1752186412216",
            password: "5FIH&19,GK8J#lrhax>e"
        });

        client.on("connect", () => {
            client.subscribe(topic);
        });

        client.on("message", (t, message) => {
            if (t === topic) {
                try {
                    const json = JSON.parse(message.toString());
                    setSensorData(json);
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



        </div>
    );
}

export default SensorDashboard;