import React, {useMemo, useState} from "react";
import Header from "../common/Header";
import {useLiveDevices} from "../common/useLiveDevices.js";
import {GERMINATION_TOPIC, bandMap, knownFields, topics} from "../common/dashboard.constants.js";
import {AS7343_MODEL_KEY, makeMeasurementKey, sanitize} from "../common/measurementUtils.js";
import spectralColors from "../../spectralColors";
import {useSensorConfig} from "../../context/SensorConfigContext.jsx";
import styles from "./LiveDashboard.module.css";
import {getNftStageContext} from "./nftStages.js";

const META_FIELDS = new Set(["timestamp", "deviceId", "compositeId", "layer"]);

function getSpectralBandKey(measurementType) {
    const normalized = sanitize(measurementType);
    if (!normalized) return undefined;

    const nmMatch = normalized.match(/^(\d+)nm$/);
    if (nmMatch) {
        const index = ["415", "445", "480", "515", "555", "590", "630", "680"].indexOf(nmMatch[1]);
        if (index !== -1) return `F${index + 1}`;
    }

    if (normalized === "clear") return "clear";
    if (normalized === "nir") return "nir";
    return undefined;
}

function getCellColor(value, range) {
    if (!range || typeof value !== "number" || Number.isNaN(value)) return "";
    if (value < range.min || value > range.max) return "#f8d7da";
    const threshold = (range.max - range.min) * 0.1;
    if (value < range.min + threshold || value > range.max - threshold) return "#fff3cd";
    return "";
}

function buildTopicList(systemTopics = {}) {
    return Object.entries(systemTopics)
        .filter(([, devices = {}]) => Object.keys(devices).length > 0);
}

function NotesList({mergedDevices = {}, extraNotes = []}) {
    const sensors = useMemo(() => {
        const result = new Set();
        for (const dev of Object.values(mergedDevices)) {
            if (Array.isArray(dev?.sensors)) {
                for (const sensor of dev.sensors) {
                    const type = sensor && (sensor.sensorType || sensor.valueType);
                    if (type) result.add(bandMap[type] || type);
                }
            }

            for (const key of Object.keys(dev || {})) {
                if (key === "health" || key === "sensors" || key === "controllers") continue;
                if (META_FIELDS.has(key)) continue;
                if (Array.isArray(dev?.sensors) && knownFields.has(key)) continue;
                result.add(bandMap[key] || key);
            }
        }
        return result;
    }, [mergedDevices]);

    const {findConfig} = useSensorConfig();
    const notes = useMemo(() => {
        const collected = [];
        for (const key of sensors) {
            const cfg = findConfig(key);
            if (cfg?.description) collected.push(`${key}: ${cfg.description}`);
        }
        return collected;
    }, [findConfig, sensors]);

    const combinedNotes = [...notes, ...extraNotes];
    if (!combinedNotes.length) return null;

    return (
        <div className={styles.noteBlock}>
            <div className={styles.noteTitle}>Notes:</div>
            <ul>
                {combinedNotes.map((note, index) => (
                    <li key={index}>{note}</li>
                ))}
            </ul>
        </div>
    );
}

function resolveStageRange(normalizedType, topic, rangeLookup) {
    if (!normalizedType || !rangeLookup) return null;
    const {byTopic, global} = rangeLookup;
    const topicKey = sanitize(topic);

    if (topicKey && byTopic?.has(topicKey)) {
        const topicMap = byTopic.get(topicKey);
        if (topicMap?.has(normalizedType)) {
            return topicMap.get(normalizedType);
        }
    }

    if (global?.has(normalizedType)) {
        return global.get(normalizedType);
    }

    return null;
}

export function DeviceTable({devices = {}, topic, rangeLookup, sensorExtrema = {}}) {
    const {findRange} = useSensorConfig();
    const compositeIds = useMemo(() => Object.keys(devices), [devices]);

    const measurementEntries = useMemo(() => {
        const entries = new Map();
        const allSensors = compositeIds.flatMap(id => devices[id].sensors || []);
        allSensors.forEach(sensor => {
            const measurementType = sensor?.sensorType || sensor?.valueType;
            if (!measurementType) return;

            const sensorModel = sensor?.sensorName || sensor?.source || "-";
            const normalizedType = sanitize(measurementType);
            const normalizedModel = sanitize(sensorModel) || normalizedType;
            const key = `${normalizedType}|${normalizedModel}`;

            if (!entries.has(key)) {
                entries.set(key, {
                    measurementType,
                    sensorModel,
                    normalizedType,
                    normalizedModel,
                    bandKey: getSpectralBandKey(measurementType),
                });
            }
        });
        return entries;
    }, [compositeIds, devices]);

    if (measurementEntries.size === 0) {
        return (
            <div className={styles.tableWrapper}>
                <div className={styles.emptyMessage}>No sensor data available.</div>
            </div>
        );
    }

    const rows = [...measurementEntries.values()].map(entry => {
        const stageRange = resolveStageRange(entry.normalizedType, topic, rangeLookup);
        const configRange = findRange(entry.measurementType, {topic, sensorModel: entry.sensorModel});
        const range = stageRange ?? configRange;
        const rowColor = entry.bandKey ? `${spectralColors[entry.bandKey]}22` : undefined;
        const measurementKey = makeMeasurementKey(entry.normalizedType, entry.normalizedModel);

        const cells = compositeIds.map((id, index) => {
            const sensors = devices[id].sensors || [];
            const matchedSensor = sensors.find(sensor => {
                const sensorType = sensor?.sensorType || sensor?.valueType;
                const sensorModel = sensor?.sensorName || sensor?.source || "-";
                return sanitize(sensorType) === entry.normalizedType &&
                    (sanitize(sensorModel) || entry.normalizedType) === entry.normalizedModel;
            });

            const value = matchedSensor?.value;
            const unit = matchedSensor?.unit || "";
            const display = (value === undefined || value === null)
                ? "-"
                : `${typeof value === "number" ? value.toFixed(1) : value}${unit ? ` ${unit}` : ""}`;
            let finalDisplay = display;

            if (entry.normalizedModel === AS7343_MODEL_KEY) {
                const extrema = sensorExtrema?.[compositeIds[index]]?.[measurementKey];
                if (extrema && typeof extrema.min === "number" && typeof extrema.max === "number" && extrema.min !== undefined && extrema.max !== undefined && display !== "-") {
                    const minDisplay = Number.isFinite(extrema.min) ? extrema.min.toFixed(1) : "-";
                    const maxDisplay = Number.isFinite(extrema.max) ? extrema.max.toFixed(1) : "-";
                    if (minDisplay !== "-" && maxDisplay !== "-") {
                        finalDisplay = `[${minDisplay} – ${maxDisplay}] ${display}`;
                    }
                }
            }
            const health = devices[id].health || {};
            const sensorKey = matchedSensor?.sensorName?.toLowerCase();
            const ok = sensorKey ? (health[sensorKey] ?? health[matchedSensor?.sensorName]) : false;
            const color = getCellColor(value, range);
            return {display: finalDisplay, ok, color};
        });

        return {
            measurementType: entry.measurementType,
            sensorModel: entry.sensorModel,
            range,
            cells,
            rowColor,
        };
    });

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th className={styles.modelCell}>S_Model</th>
                    <th className={styles.sensorCell}>M_Type</th>
                    <th className={styles.modelCell}>Min</th>
                    <th className={styles.modelCell}>Max</th>
                    {compositeIds.map(id => {
                        const device = devices[id];
                        const label = device?.compositeId || id;
                        return <th key={id}>{label}</th>;
                    })}
                </tr>
                </thead>
                <tbody>
                {rows.map(row => (
                    <tr key={`${row.measurementType}-${row.sensorModel}`}>
                        <td className={styles.modelCell}>{row.sensorModel}</td>
                        <td className={styles.sensorCell} style={{backgroundColor: row.rowColor}}>
                            {row.measurementType}
                        </td>
                        <td style={{backgroundColor: row.rowColor}}>{row.range?.min ?? "-"}</td>
                        <td style={{backgroundColor: row.rowColor}}>{row.range?.max ?? "-"}</td>
                        {row.cells.map((cell, index) => (
                            <td key={compositeIds[index]} style={{backgroundColor: cell.color}}>
                                <div className={styles.cellWrapper}>
                                    <span
                                        className={`${styles.indicator} ${cell.ok ? styles.indicatorOn : styles.indicatorOff}`}
                                    ></span>
                                    <span className={styles.cellValue}>{cell.display}</span>
                                </div>
                            </td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}

function TopicGroups({systemTopics = {}, rangeLookup, sensorExtrema = {}}) {
    const topics = useMemo(() => buildTopicList(systemTopics), [systemTopics]);
    if (!topics.length) return null;

    return (
        <div className={styles.topicSection}>
            {topics.map(([topic, devices]) => (
                <div key={topic} className={styles.deviceGroup}>
                    <h3 className={styles.topicTitle}>{topic}</h3>
                    <DeviceTable topic={topic} devices={devices} rangeLookup={rangeLookup} sensorExtrema={sensorExtrema}/>
                </div>
            ))}
        </div>
    );
}

function StageSummary({dayNumber, onDayChange, summaries}) {
    if (!summaries.length) return null;

    return (
        <div className={styles.stageSection}>
            <div className={styles.stageControls}>
                <label className={styles.dayInputLabel}>
                    Day after transplant
                    <input
                        type="number"
                        min={1}
                        max={120}
                        value={dayNumber}
                        onChange={event => {
                            const value = Number(event.target.value);
                            onDayChange(Number.isFinite(value) ? Math.max(1, value) : 1);
                        }}
                        className={styles.dayInput}
                    />
                </label>
                <div className={styles.stageHint}>Adjust the day to see target ranges per stage.</div>
            </div>
            <div className={styles.stageSummaryGrid}>
                {summaries.map((summary) => (
                    <div key={summary.groupId} className={styles.stageCard}>
                        <div className={styles.stageCardHeader}>
                            <div className={styles.stageGroup}>{summary.groupLabel}</div>
                            <div className={styles.stageDescription}>{summary.description}</div>
                            {summary.daysLabel && (
                                <div className={styles.stageDays}>Target window {summary.daysLabel}</div>
                            )}
                            {summary.isBeforeRange && (
                                <div className={styles.stageStatus}>Before defined schedule</div>
                            )}
                            {summary.isBeyondRange && (
                                <div className={styles.stageStatus}>Beyond defined schedule</div>
                            )}
                        </div>
                        <ul className={styles.stageMetricList}>
                            {summary.metrics.map((metric) => (
                                <li key={`${summary.groupId}-${metric.label}`}>
                                    <span className={styles.metricName}>{metric.label}</span>
                                    <span className={styles.metricRange}>
                                        {metric.range.min ?? "?"}–{metric.range.max ?? "?"}
                                        {metric.range.unit ? ` ${metric.range.unit}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {summary.notes && summary.notes.length > 0 && (
                            <div className={styles.stageNotes}>
                                {summary.notes.map((note, index) => (
                                    <div key={index}>{note}</div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function LiveDashboard() {
    const {deviceData, mergedDevices, sensorExtrema} = useLiveDevices(topics);
    const [dayNumber, setDayNumber] = useState(21);
    const stageContext = useMemo(() => getNftStageContext(dayNumber), [dayNumber]);

    const aggregatedTopics = useMemo(() => {
        const allTopics = {};
        for (const systemTopic of Object.values(deviceData)) {
            for (const [topic, devices] of Object.entries(systemTopic)) {
                allTopics[topic] = {...(allTopics[topic] || {}), ...devices};
            }
        }
        return allTopics;
    }, [deviceData]);

    const filteredTopics = useMemo(() => {
        const entries = Object.entries(aggregatedTopics)
            .filter(([topic]) => topic !== GERMINATION_TOPIC);
        return Object.fromEntries(entries);
    }, [aggregatedTopics]);

    return (
        <div className={styles.dashboard}>
            <Header title="NFT Channels"/>
            <section className={styles.section}>
                <div className={styles.sectionBody}>
                    <StageSummary
                        dayNumber={dayNumber}
                        onDayChange={setDayNumber}
                        summaries={stageContext.summaries}
                    />
                    <NotesList mergedDevices={mergedDevices} extraNotes={stageContext.notes}/>
                    <TopicGroups
                        systemTopics={filteredTopics}
                        rangeLookup={stageContext.rangeLookup}
                        sensorExtrema={sensorExtrema}
                    />
                </div>
            </section>
        </div>
    );
}

export default LiveDashboard;
