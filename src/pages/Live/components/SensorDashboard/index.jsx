// SensorDashboard.jsx
import React, {useMemo} from "react";
import Header from "../../../common/Header";
import { useLiveDevices } from "../../../common/useLiveDevices.js";
import styles from "./SensorDashboard.module.css";
import Live from "../Live";
import {GERMINATION_TOPIC, topics} from "../../../common/dashboard.constants.js";

function SensorDashboard({ view, title = '' }) {
    const {deviceData, mergedDevices} = useLiveDevices(topics);

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
    const filteredSystemTopics = useMemo(() => {
        return Object.fromEntries(
            Object.entries(aggregatedTopics).filter(([topic]) => topic !== GERMINATION_TOPIC)
        );
    }, [aggregatedTopics]);
    return (
        <div className={styles.dashboard}>
            <Header title={title}/>
            {view !== 'overview' && (
                <Live
                    mergedDevices={mergedDevices}
                    systemTopics={filteredSystemTopics}
                />
            )}
        </div>
    );
}

export default SensorDashboard;
