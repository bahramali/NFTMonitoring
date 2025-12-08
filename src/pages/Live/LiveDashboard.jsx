import React, {useEffect, useMemo, useState} from "react";
import Header from "../common/Header";
import {useLiveDevices} from "../common/useLiveDevices.js";
import {GERMINATION_TOPIC, bandMap, knownFields, topics} from "../common/dashboard.constants.js";
import {AS7343_MODEL_KEY, makeMeasurementKey, sanitize} from "../common/measurementUtils.js";
import {useSensorConfig} from "../../context/SensorConfigContext.jsx";
import SpectrumBarChart from "./SpectrumBarChart.jsx";
import HistoryChart from "../../components/HistoryChart.jsx";
import spectralColors from "../../spectralColors";
import styles from "./LiveDashboard.module.css";
import {getNftStageContext} from "./nftStages.js";

const META_FIELDS = new Set(["timestamp", "deviceId", "compositeId", "layer"]);

const METRIC_HISTORY_WINDOW_MS = 15 * 60 * 1000;

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

function buildTopicList(systemTopics = {}) {
    return Object.entries(systemTopics)
        .filter(([, devices = {}]) => Object.keys(devices).length > 0);
}

function formatValue(value) {
    if (value === undefined || value === null || Number.isNaN(value)) return "-";
    if (typeof value === "number") {
        const abs = Math.abs(value);
        const decimals = abs >= 100 ? 0 : 1;
        return value.toFixed(decimals);
    }
    return String(value);
}

function formatTimestamp(timestamp) {
    if (!Number.isFinite(timestamp)) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"});
}

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
                <div className={styles.metricEmpty}>No sensor data available.</div>
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

function DeviceMetricCard({topic, device, rangeLookup}) {
    const {findRange} = useSensorConfig();
    const sensors = Array.isArray(device?.sensors) ? device.sensors : [];
    const metrics = sensors.map((sensor, index) => {
        const measurementType = sensor?.sensorType || sensor?.valueType || "Metric";
        const normalizedType = sanitize(measurementType);
        const sensorModel = sensor?.sensorName || sensor?.source || "";
        const range = resolveStageRange(normalizedType, topic, rangeLookup)
            || findRange(measurementType, {topic, sensorModel});
        const numeric = typeof sensor?.value === "number" ? sensor.value : Number(sensor?.value);
        const hasNumeric = Number.isFinite(numeric);
        const inRange = range && hasNumeric
            ? numeric >= range.min && numeric <= range.max
            : true;
        const statusClass = hasNumeric
            ? (inRange ? styles.metricOk : styles.metricAlert)
            : styles.metricIdle;
        const valueDisplay = formatValue(hasNumeric ? numeric : sensor?.value);
        const unit = sensor?.unit ? ` ${sensor.unit}` : "";
        return {
            key: `${measurementType}-${sensorModel || index}`,
            label: measurementType,
            valueDisplay: `${valueDisplay}${unit}`,
            range,
            statusClass,
        };
    });

    const meta = [];
    for (const [key, value] of Object.entries(device?.extra || {})) {
        if (META_FIELDS.has(key)) continue;
        meta.push({key, value});
    }

    return (
        <div className={styles.deviceCard}>
            <div className={styles.deviceCardHeader}>
                <div>
                    <div className={styles.deviceTopic}>{topic}</div>
                    <div className={styles.deviceId}>{device?.compositeId || device?.deviceId || "Unknown"}</div>
                    {device?.layer && <div className={styles.deviceLayer}>Layer {device.layer}</div>}
                </div>
                <div className={styles.deviceMetaBlock}>
                    {device?.receivedAt && (
                        <span className={styles.deviceMeta}>Updated {formatTimestamp(device.receivedAt)}</span>
                    )}
                    {device?.health && Object.keys(device.health).length > 0 && (
                        <span className={styles.deviceHealth}>{Object.values(device.health).every(Boolean) ? "Healthy" : "Attention"}</span>
                    )}
                </div>
            </div>
            <div className={styles.metricGrid}>
                {metrics.length === 0 && (
                    <div className={styles.metricEmpty}>No live metrics yet</div>
                )}
                {metrics.map((metric) => (
                    <div key={metric.key} className={`${styles.metricTile} ${metric.statusClass}`}>
                        <div className={styles.metricLabel}>{metric.label}</div>
                        <div className={styles.metricValue}>{metric.valueDisplay}</div>
                        {metric.range && (
                            <div className={styles.metricRange}>Target: {metric.range.min ?? "-"} – {metric.range.max ?? "-"}</div>
                        )}
                    </div>
                ))}
            </div>
            {meta.length > 0 && (
                <div className={styles.metaGrid}>
                    {meta.map(entry => (
                        <div key={entry.key} className={styles.metaItem}>
                            <div className={styles.metaLabel}>{entry.key}</div>
                            <div className={styles.metaValue}>{String(entry.value)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LiveDashboard() {
    const {deviceData, mergedDevices, sensorData} = useLiveDevices(topics);
    const [selectedCompositeId, setSelectedCompositeId] = useState("");
    const [selectedMetricKey, setSelectedMetricKey] = useState("");
    const [metricHistory, setMetricHistory] = useState({});
    const stageContext = useMemo(() => getNftStageContext(21), []);

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

    const topicDevices = useMemo(() => buildTopicList(filteredTopics), [filteredTopics]);

    const allDeviceEntries = useMemo(() => {
        const list = [];
        for (const [topic, devices] of topicDevices) {
            for (const [id, device] of Object.entries(devices || {})) {
                list.push({topic, id, device});
            }
        }
        return list;
    }, [topicDevices]);

    useEffect(() => {
        if (!selectedCompositeId && allDeviceEntries.length > 0) {
            setSelectedCompositeId(allDeviceEntries[0].id);
        }
    }, [allDeviceEntries, selectedCompositeId]);

    useEffect(() => {
        if (Object.keys(mergedDevices).length === 0) return;

        setMetricHistory((prev) => {
            const next = {...prev};
            let changed = false;

            for (const [compositeId, device] of Object.entries(mergedDevices)) {
                const sensors = Array.isArray(device?.sensors) ? device.sensors : [];
                if (sensors.length === 0) continue;

                const timestamp = Number.isFinite(device?.receivedAt) ? device.receivedAt : Date.now();
                const deviceHistory = {...(next[compositeId] || {})};
                let deviceChanged = false;

                for (const sensor of sensors) {
                    const measurementType = sensor?.sensorType || sensor?.valueType;
                    const normalizedType = sanitize(measurementType);
                    if (!normalizedType) continue;

                    const sensorModel = sensor?.sensorName || sensor?.source || "";
                    const normalizedModel = sanitize(sensorModel) || normalizedType;
                    const measurementKey = makeMeasurementKey(normalizedType, normalizedModel);
                    const value = Number(sensor?.value);

                    if (!Number.isFinite(value)) continue;

                    const history = deviceHistory[measurementKey] || [];
                    const updatedHistory = [...history, {timestamp, value}]
                        .filter(point => timestamp - point.timestamp <= METRIC_HISTORY_WINDOW_MS);

                    deviceHistory[measurementKey] = updatedHistory;
                    deviceChanged = true;
                }

                if (deviceChanged) {
                    next[compositeId] = deviceHistory;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [mergedDevices]);

    const selectedSensorData = selectedCompositeId ? sensorData[selectedCompositeId] : null;
    const selectedDeviceInfo = allDeviceEntries.find(entry => entry.id === selectedCompositeId);

    const selectedSensors = useMemo(() => {
        const merged = selectedCompositeId ? mergedDevices[selectedCompositeId] : null;
        if (Array.isArray(merged?.sensors)) return merged.sensors;
        const fallback = selectedDeviceInfo?.device?.sensors;
        return Array.isArray(fallback) ? fallback : [];
    }, [mergedDevices, selectedCompositeId, selectedDeviceInfo]);

    const metricOptions = useMemo(() => {
        const seen = new Set();
        const options = [];

        for (const sensor of selectedSensors) {
            const measurementType = sensor?.sensorType || sensor?.valueType;
            const normalizedType = sanitize(measurementType);
            if (!normalizedType) continue;

            const sensorModel = sensor?.sensorName || sensor?.source || "";
            const displayLabel = measurementType || "Metric";
            const normalizedModel = sanitize(sensorModel) || normalizedType;
            const measurementKey = makeMeasurementKey(normalizedType, normalizedModel);
            if (seen.has(measurementKey)) continue;
            seen.add(measurementKey);

            const numericValue = Number(sensor?.value);
            const hasNumeric = Number.isFinite(numericValue);

            options.push({
                key: measurementKey,
                label: sensorModel ? `${displayLabel} • ${sensorModel}` : displayLabel,
                unit: sensor?.unit || "",
                hasNumeric,
            });
        }

        return options.filter(option => option.hasNumeric);
    }, [selectedSensors]);

    useEffect(() => {
        if (!selectedCompositeId) {
            setSelectedMetricKey("");
            return;
        }

        if (metricOptions.length === 0) {
            setSelectedMetricKey("");
            return;
        }

        if (!metricOptions.some(option => option.key === selectedMetricKey)) {
            setSelectedMetricKey(metricOptions[0].key);
        }
    }, [metricOptions, selectedCompositeId, selectedMetricKey]);

    const selectedMetricHistory = useMemo(() => {
        if (!selectedCompositeId || !selectedMetricKey) return [];
        return metricHistory[selectedCompositeId]?.[selectedMetricKey] || [];
    }, [metricHistory, selectedCompositeId, selectedMetricKey]);

    const selectedMetric = useMemo(
        () => metricOptions.find(option => option.key === selectedMetricKey),
        [metricOptions, selectedMetricKey]
    );

    const sortedMetricHistory = useMemo(
        () => [...selectedMetricHistory].sort((a, b) => a.timestamp - b.timestamp),
        [selectedMetricHistory]
    );

    const metricSeries = useMemo(() => {
        if (!sortedMetricHistory.length) return [];
        return [{
            name: selectedMetric?.label || "Value",
            data: sortedMetricHistory,
            yDataKey: "value",
            color: "#7fb5ff",
        }];
    }, [selectedMetric?.label, sortedMetricHistory]);

    const metricDomain = useMemo(() => {
        if (!sortedMetricHistory.length) return undefined;
        const first = sortedMetricHistory[0]?.timestamp;
        const last = sortedMetricHistory[sortedMetricHistory.length - 1]?.timestamp;
        return Number.isFinite(first) && Number.isFinite(last) ? [first, last] : undefined;
    }, [sortedMetricHistory]);

    const metricYAxisLabel = useMemo(() => {
        if (!selectedMetric) return "Value";
        return selectedMetric.unit ? `${selectedMetric.label} (${selectedMetric.unit})` : selectedMetric.label;
    }, [selectedMetric]);

    return (
        <div className={styles.page}>
            <Header title="NFT Live Overview"/>
            <div className={styles.pageGrid}>
                <section className={`${styles.sectionCard} ${styles.chartSection}`}>
                    <div className={styles.sectionHeader}>Live charts</div>
                    <div className={styles.selectorRow}>
                        <label className={styles.selectorLabel}>
                            Device
                            <select
                                value={selectedCompositeId}
                                onChange={(event) => setSelectedCompositeId(event.target.value)}
                                className={styles.deviceSelect}
                            >
                                <option value="" disabled>Select a device</option>
                                {allDeviceEntries.map((entry) => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.topic} · {entry.device?.compositeId || entry.id}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {selectedDeviceInfo?.device?.receivedAt && (
                            <div className={styles.lastUpdated}>Last update {formatTimestamp(selectedDeviceInfo.device.receivedAt)}</div>
                        )}
                    </div>
                    <div className={styles.chartStack}>
                        <div className={styles.chartBlock}>
                            <div className={styles.subSectionHeader}>Spectrum snapshot</div>
                            <div className={styles.chartWrapper}>
                                {selectedSensorData ? (
                                    <SpectrumBarChart sensorData={selectedSensorData}/>
                                ) : (
                                    <div className={styles.chartEmpty}>Select a device to view its latest spectrum</div>
                                )}
                            </div>
                        </div>

                        <div className={styles.chartBlock}>
                            <div className={styles.subSectionHeader}>Metric trend</div>
                            <div className={styles.metricSelectorRow}>
                                <label className={styles.selectorLabel}>
                                    Metric
                                    <select
                                        value={selectedMetricKey}
                                        onChange={(event) => setSelectedMetricKey(event.target.value)}
                                        className={styles.metricSelect}
                                        disabled={metricOptions.length === 0}
                                    >
                                        {metricOptions.length === 0 && (
                                            <option value="">No numeric metrics available</option>
                                        )}
                                        {metricOptions.map(option => (
                                            <option key={option.key} value={option.key}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                {metricOptions.length > 1 && (
                                    <div className={styles.selectorHint}>Each sensor is charted separately—pick a metric to stream live values.</div>
                                )}
                            </div>
                            <div className={styles.chartWrapper}>
                                {metricSeries.length > 0 ? (
                                    <HistoryChart
                                        xDataKey="timestamp"
                                        series={metricSeries}
                                        yLabel={metricYAxisLabel}
                                        xDomain={metricDomain}
                                        height={340}
                                    />
                                ) : (
                                    <div className={styles.chartEmpty}>
                                        {selectedCompositeId ? "Waiting for metric updates..." : "Select a device to begin streaming metrics"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className={`${styles.sectionCard} ${styles.devicesSection}`}>
                    <div className={styles.sectionHeader}>Metrics by device</div>
                    <div className={styles.deviceGrid}>
                        {allDeviceEntries.length === 0 && (
                            <div className={styles.metricEmpty}>Waiting for devices to publish data...</div>
                        )}
                        {allDeviceEntries.map(({topic, id, device}) => (
                            <DeviceMetricCard
                                key={`${topic}-${id}`}
                                topic={topic}
                                device={mergedDevices[id] || device}
                                rangeLookup={stageContext.rangeLookup}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default LiveDashboard;
