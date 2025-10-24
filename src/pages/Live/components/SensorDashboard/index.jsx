// SensorDashboard.jsx
import React, {useEffect, useMemo, useState} from "react";
import Header from "../../../common/Header";
import { useLiveDevices } from "../../../common/useLiveDevices.js";
import styles from "./SensorDashboard.module.css";
import Live from "../Live";
import {SENSOR_TOPIC, topics} from "../../../common/dashboard.constants.js";

function SensorDashboard({ view, title = '' }) {
    const {deviceData, sensorData, availableCompositeIds, mergedDevices} = useLiveDevices(topics);

    const [selectedDevice, setSelectedDevice] = useState("");

    // Merge topics from all systems
    const aggregatedTopics = useMemo(() => {
        const allTopics = {};
        for (const sysTopics of Object.values(deviceData)) {
            for (const [topic, devices] of Object.entries(sysTopics)) {
                allTopics[topic] = { ...(allTopics[topic] || {}), ...devices };
            }
        }
        return allTopics;
    }, [deviceData]);
    const sensorTopicDevices = aggregatedTopics[SENSOR_TOPIC] || {};

    // Show all available device IDs and topics
    const filteredCompositeIds = availableCompositeIds;
    // Ensure selectedDevice remains valid after device list changes
    useEffect(() => {
        if (availableCompositeIds.length && !availableCompositeIds.includes(selectedDevice)) {
            setSelectedDevice(availableCompositeIds[0]);
        }
    }, [availableCompositeIds, selectedDevice]);

    return (
        <div className={styles.dashboard}>
            <Header title={title}/>
            {view !== 'overview' && (
                <Live
                    sensorTopicDevices={sensorTopicDevices}
                    selectedDevice={selectedDevice}
                    setSelectedDevice={setSelectedDevice}
                    filteredCompositeIds={filteredCompositeIds}
                    sensorData={sensorData}
                    mergedDevices={mergedDevices}
                />
            )}
        </div>
    );
}

export default SensorDashboard;
