// SensorDashboard.jsx
import React, {useEffect, useState} from "react";
import Header from "../../../common/Header";
import { useLiveDevices } from "../../../common/useLiveDevices.js";
import styles from "./SensorDashboard.module.css";
import Live from "../Live";
import {SENSOR_TOPIC, topics} from "../../../common/dashboard.constants.js";

function SensorDashboard({ view, title = '' }) {
    const activeSystem = "S01";
    const {deviceData, sensorData, availableCompositeIds, mergedDevices} = useLiveDevices(topics, activeSystem);

    const [selectedDevice, setSelectedDevice] = useState("");

    // Topics for the currently active system across all topic streams
    const activeSystemTopics = deviceData[activeSystem] || {};
    const sensorTopicDevices = activeSystemTopics[SENSOR_TOPIC] || {};

    // Show all available device IDs and topics
    const filteredCompositeIds = availableCompositeIds;
    const filteredSystemTopics = activeSystemTopics;

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
                    filteredSystemTopics={filteredSystemTopics}
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
