import React, {useEffect, useMemo, useState} from "react";
import Header from "../common/Header";
import {useLiveDevices} from "../common/useLiveDevices.js";
import {GERMINATION_TOPIC, WATER_FLOW_TOPIC, bandMap, knownFields, topics} from "../common/dashboard.constants.js";
import {AS7343_MODEL_KEY, makeMeasurementKey, sanitize} from "../common/measurementUtils.js";
import {useSensorConfig} from "../../context/SensorConfigContext.jsx";
import SpectrumBarChart from "./SpectrumBarChart.jsx";
import spectralColors from "../../spectralColors";
import styles from "./LiveDashboard.module.css";
import {getNftStageContext} from "./nftStages.js";

const META_FIELDS = new Set(["timestamp", "deviceId", "compositeId", "layer"]);

const WATER_STATUS_KEYS = [
    "status",
    "state",
    "value",
    "running",
    "active",
    "isActive",
    "isOn",
    "enabled",
    "flow",
    "waterFlow",
];

const ON_STRINGS = new Set(["on", "true", "enabled", "running", "active", "open", "flowing", "start", "started"]);
const OFF_STRINGS = new Set(["off", "false", "disabled", "stopped", "inactive", "closed", "stopping", "stop"]);

function coerceWaterStatus(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (Number.isNaN(value)) return null;
        return value !== 0;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        if (ON_STRINGS.has(normalized)) return true;
        if (OFF_STRINGS.has(normalized)) return false;
        if (!Number.isNaN(Number(normalized))) {
            return Number(normalized) !== 0;
        }
    }
    return null;
}

function extractWaterFlowStatus(device = {}) {
    const extra = device.extra && typeof device.extra === "object" ? device.extra : null;
    const controllers = Array.isArray(device.controllers) ? device.controllers : [];
    const candidates = [];

    if (extra) {
        for (const key of WATER_STATUS_KEYS) {
            if (extra[key] !== undefined) {
                candidates.push(extra[key]);
            }
        }
    }

    for (const controller of controllers) {
        if (!controller || typeof controller !== "object") continue;
        for (const key of ["state", "status", "value"]) {
            if (controller[key] !== undefined) {
                candidates.push(controller[key]);
            }
        }
    }

    for (const candidate of candidates) {
        const status = coerceWaterStatus(candidate);
        if (status !== null) {
            return {
                isOn: status,
                label: status ? "On" : "Off",
                rawValue: candidate,
                source: device.compositeId || device.deviceId || "",
            };
        }
    }

    return null;
}

function WaterFlowStatus({status}) {
    const hasData = status && typeof status.isOn === "boolean";
    const indicatorClassNames = [styles.statusDot];
    if (hasData) {
        indicatorClassNames.push(status.isOn ? styles.statusDotOn : styles.statusDotOff);
    } else {
        indicatorClassNames.push(styles.statusDotIdle);
    }

    const updatedLabel = (hasData && status.receivedAt)
        ? new Date(status.receivedAt).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"})
        : null;

    return (
        <div className={styles.statusTile}>
            <div className={styles.statusHeading}>
                <span className={indicatorClassNames.join(" ")} aria-hidden="true"></span>
                <span className={styles.statusLabel}>Water Flow</span>
            </div>
            <div className={styles.statusValue}>
                {hasData ? status.label : "Waiting for data"}
            </div>
            {hasData && status.source && (
                <div className={styles.statusSub}>Source: {status.source}</div>
            )}
            {updatedLabel && (
                <div className={styles.statusMeta}>Updated {updatedLabel}</div>
            )}
            {hasData && status.rawValue !== status.label && status.rawValue !== undefined && (
                <div className={styles.statusMeta}>Raw: {String(status.rawValue)}</div>
            )}
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
    const [dayNumber, setDayNumber] = useState(21);
    const [selectedCompositeId, setSelectedCompositeId] = useState("");
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

    const waterFlowStatus = useMemo(() => {
        const topicDevices = aggregatedTopics[WATER_FLOW_TOPIC];
        if (!topicDevices) return null;

        let latest = null;
        for (const device of Object.values(topicDevices)) {
            if (!device) continue;
            const parsed = extractWaterFlowStatus(device);
            if (!parsed) continue;
            const receivedAt = Number.isFinite(device.receivedAt) ? device.receivedAt : Date.now();
            if (!latest || receivedAt > latest.receivedAt) {
                latest = {...parsed, receivedAt};
            }
        }

        return latest;
    }, [aggregatedTopics]);

    const filteredTopics = useMemo(() => {
        const entries = Object.entries(aggregatedTopics)
            .filter(([topic]) => topic !== GERMINATION_TOPIC && topic !== WATER_FLOW_TOPIC);
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

    const selectedSensorData = selectedCompositeId ? sensorData[selectedCompositeId] : null;
    const selectedDeviceInfo = allDeviceEntries.find(entry => entry.id === selectedCompositeId);

    return (
        <div className={styles.page}>
            <Header title="NFT Live Overview"/>
            <div className={styles.pageGrid}>
                <section className={`${styles.sectionCard} ${styles.statusSection}`}>
                    <div className={styles.sectionHeader}>Realtime status</div>
                    <div className={styles.statusGrid}>
                        <WaterFlowStatus status={waterFlowStatus}/>
                        <div className={styles.statusTile}>
                            <div className={styles.statusHeading}>Day after transplant</div>
                            <div className={styles.dayRow}>
                                <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={dayNumber}
                                    onChange={event => {
                                        const value = Number(event.target.value);
                                        setDayNumber(Number.isFinite(value) ? Math.max(1, value) : 1);
                                    }}
                                    className={styles.dayInput}
                                />
                                <div className={styles.statusMeta}>Adjust to update stage targets</div>
                            </div>
                        </div>
                        <div className={styles.statusTile}>
                            <div className={styles.statusHeading}>Stage summary</div>
                            <div className={styles.stageSummaryGrid}>
                                {stageContext.summaries.map((summary) => (
                                    <div key={summary.groupId} className={styles.stageChip}>
                                        <div className={styles.stageGroup}>{summary.groupLabel}</div>
                                        <div className={styles.stageDescription}>{summary.description}</div>
                                        {summary.daysLabel && (
                                            <div className={styles.stageDays}>Target {summary.daysLabel}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className={`${styles.sectionCard} ${styles.chartSection}`}>
                    <div className={styles.sectionHeader}>Live spectrum</div>
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
                    <div className={styles.chartWrapper}>
                        {selectedSensorData ? (
                            <SpectrumBarChart sensorData={selectedSensorData}/>
                        ) : (
                            <div className={styles.chartEmpty}>Select a device to view its latest spectrum</div>
                        )}
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
