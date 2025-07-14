import React, { useEffect, useState } from 'react';
import mqtt from 'mqtt';
import SpectralChart from './SpectralChart';
import SensorDashboard from './SensorDashboard';

function App() {
    const [spectralData, setSpectralData] = useState([]);

    useEffect(() => {
        const client = mqtt.connect('wss://1457f4a458cd4b4e9175ae1816356ce1.s1.eu.hivemq.cloud:8884/mqtt', {
            username: "hivemq.webclient.1752186412216",
            password: "5FIH&19,GK8J#lrhax>e",
            protocol: "wss"
        });

        client.on('connect', () => {
            console.log('Connected to MQTT broker');
            client.subscribe('azadFarm/sensorData');
        });

        client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());

                const chartData = Object.entries(payload).map(([band, intensity]) => ({
                    band,
                    intensity
                }));
                setSpectralData(chartData);
            } catch (err) {
                console.error('خطا در تبدیل پیام:', err);
            }
        });

        return () => client.end();
    }, []);

    return (
        <div>
            <SensorDashboard />
        </div>
    );
}

export default App;