import React, { useEffect, useMemo, useState } from "react";
import Header from "../common/Header";
import { useLiveDevices } from "../common/useLiveDevices";
import { GERMINATION_TOPIC, topics } from "../common/dashboard.constants";
import TopicSection from "../Live/components/TopicSection";
import GerminationCamera from "./components/GerminationCamera";
import styles from "./Germination.module.css";

const STORAGE_KEY = "germination:start-time";

function calculateElapsed(value) {
    if (!value) return null;
    const start = new Date(value);
    if (Number.isNaN(start.getTime())) return null;

    const diffMs = Date.now() - start.getTime();
    const safeDiff = diffMs < 0 ? 0 : diffMs;
    const totalSeconds = Math.floor(safeDiff / 1000);

    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds };
}

function formatElapsed(elapsed) {
    if (!elapsed) return "Set a start time to begin tracking";
    const parts = [
        `${elapsed.days}d`,
        `${elapsed.hours.toString().padStart(2, "0")}h`,
        `${elapsed.minutes.toString().padStart(2, "0")}m`,
        `${elapsed.seconds.toString().padStart(2, "0")}s`,
    ];
    return parts.join(" : ");
}

export default function Germination() {
    const { deviceData } = useLiveDevices(topics);
    const [startTime, setStartTime] = useState(() => {
        if (typeof window === "undefined") return "";
        return localStorage.getItem(STORAGE_KEY) || "";
    });
    const [elapsed, setElapsed] = useState(() => calculateElapsed(startTime));

    useEffect(() => {
        setElapsed(calculateElapsed(startTime));
        if (typeof window === "undefined") return;
        if (startTime) {
            localStorage.setItem(STORAGE_KEY, startTime);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [startTime]);

    useEffect(() => {
        if (!startTime) return undefined;
        const interval = setInterval(() => {
            setElapsed(calculateElapsed(startTime));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const aggregatedTopics = useMemo(() => {
        const allTopics = {};
        for (const sysTopics of Object.values(deviceData)) {
            for (const [topic, devices] of Object.entries(sysTopics)) {
                allTopics[topic] = { ...(allTopics[topic] || {}), ...devices };
            }
        }
        return allTopics;
    }, [deviceData]);

    const germinationTopics = useMemo(() => {
        if (!aggregatedTopics[GERMINATION_TOPIC]) {
            return {};
        }

        return {
            [GERMINATION_TOPIC]: aggregatedTopics[GERMINATION_TOPIC],
        };
    }, [aggregatedTopics]);

    const hasTopics = Object.keys(germinationTopics).length > 0;

    const handleStartChange = (event) => {
        setStartTime(event.target.value);
    };

    const handleClearStart = () => {
        setStartTime("");
    };

    return (
        <div className={styles.page}>
            <Header title="Germination" />

            <section className={styles.timerSection}>
                <div className={styles.timerControls}>
                    <label>
                        Start time
                        <input
                            type="datetime-local"
                            value={startTime}
                            onChange={handleStartChange}
                            className={styles.timeInput}
                        />
                    </label>
                    <button
                        type="button"
                        className={styles.clearButton}
                        onClick={handleClearStart}
                        disabled={!startTime}
                    >
                        Clear
                    </button>
                </div>
                <div className={styles.elapsedWrapper}>
                    <span className={styles.elapsedLabel}>Elapsed time</span>
                    <span className={styles.elapsedValue}>{formatElapsed(elapsed)}</span>
                </div>
            </section>

            <section className={`${styles.sectionCard} ${styles.cameraSection}`}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Germination Room Camera</h2>
                </div>
                <div className={styles.cameraWrapper}>
                    <GerminationCamera />
                </div>
            </section>

            <section className={`${styles.sectionCard} ${styles.tableSection}`}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Live Sensor Table</h2>
                </div>
                {hasTopics ? (
                    <TopicSection systemTopics={germinationTopics} />
                ) : (
                    <div className={styles.emptyState}>No live sensor data available.</div>
                )}
            </section>

            <section className={`${styles.sectionCard} ${styles.reportSection}`}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Germination Report</h2>
                </div>
                <textarea
                    className={styles.reportInput}
                    placeholder="Record daily observations, tasks, and outcomes for the germination room."
                />
            </section>
        </div>
    );
}
