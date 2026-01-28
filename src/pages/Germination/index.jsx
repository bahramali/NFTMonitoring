import React, { useEffect, useMemo, useState } from "react";
import Header from "../common/Header";
import { useLiveDevices } from "../common/useLiveDevices";
import { WS_TOPICS } from "../common/dashboard.constants";
import GerminationCamera from "./components/GerminationCamera";
import HistoryChart from "../../components/HistoryChart.jsx";
import { transformAggregatedData } from "../../utils.js";
import { authFetch } from "../../api/http.js";
import {
    getGerminationStatus,
    triggerGerminationStart,
    updateGerminationStart,
} from "../../api/germination.js";
import { getGerminationStageByDay, getStageRangeForMetric } from "./germinationStages.js";
import styles from "./Germination.module.css";

import { getApiBaseUrl } from '../../config/apiBase.js';

const API_BASE = getApiBaseUrl();

const RANGE_OPTIONS = [
    { key: "1h", label: "Last hour" },
    { key: "6h", label: "Last 6 hours" },
    { key: "24h", label: "Last 24 hours" },
    { key: "custom", label: "Custom" },
];

function toLocalInputValue(date) {
    const pad = (value) => `${value}`.padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLocalInput(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function getPresetRange(preset) {
    const now = new Date();
    switch (preset) {
        case "1h":
            return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
        case "6h":
            return { from: new Date(now.getTime() - 6 * 60 * 60 * 1000), to: now };
        case "24h":
            return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now };
        default:
            return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
    }
}

function getEntryValue(entry, metricKey) {
    if (!metricKey) return null;
    const normalized = metricKey.toLowerCase();
    const valueFromMap = {
        temperature: entry.temperature?.value,
        humidity: entry.humidity?.value,
        light: entry.lux?.value ?? entry.light?.value,
        lux: entry.lux?.value ?? entry.light?.value,
        tds: entry.tds?.value,
        dissolvedtds: entry.tds?.value,
        ec: entry.ec?.value,
        dissolvedec: entry.ec?.value,
        ph: entry.ph?.value,
        do: entry.do?.value,
        dissolvedoxygen: entry.do?.value,
    };

    if (normalized in valueFromMap && valueFromMap[normalized] !== undefined) {
        const mapped = valueFromMap[normalized];
        return mapped === null || Number.isNaN(Number(mapped)) ? null : Number(mapped);
    }

    const directValue = entry[metricKey] ?? entry[normalized];
    if (typeof directValue === "number") {
        return Number.isNaN(directValue) ? null : directValue;
    }
    if (directValue && typeof directValue === "object" && "value" in directValue) {
        const numeric = Number(directValue.value);
        return Number.isNaN(numeric) ? null : numeric;
    }

    return null;
}

function formatRangeValue(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    const abs = Math.abs(value);
    let decimals = 0;
    if (abs >= 100 || Number.isInteger(value)) {
        decimals = 0;
    } else if (abs >= 10) {
        decimals = 1;
    } else if (abs >= 1) {
        decimals = 1;
    } else if (abs >= 0.1) {
        decimals = 2;
    } else {
        decimals = 3;
    }
    return Number(value.toFixed(decimals)).toString();
}

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

function toLocalInputValueIfValid(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return toLocalInputValue(date);
}

export default function Germination() {
    const { deviceData } = useLiveDevices(WS_TOPICS);
    const [startTime, setStartTime] = useState("");
    const [elapsed, setElapsed] = useState(() => calculateElapsed(""));
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [rangePreset, setRangePreset] = useState("1h");
    const [customFrom, setCustomFrom] = useState(() => {
        const now = new Date();
        const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        return toLocalInputValue(start);
    });
    const [customTo, setCustomTo] = useState(() => toLocalInputValue(new Date()));
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [selectedCompositeId, setSelectedCompositeId] = useState("");
    const [selectedMetricKey, setSelectedMetricKey] = useState("");
    const [chartData, setChartData] = useState([]);
    const [chartDomain, setChartDomain] = useState(null);
    const [chartError, setChartError] = useState("");
    const [chartLoading, setChartLoading] = useState(false);

    const stageDetails = useMemo(() => {
        if (!startTime) return null;
        const parsed = parseLocalInput(startTime);
        if (!parsed) return null;

        let dayNumber;
        if (elapsed && typeof elapsed.days === "number") {
            dayNumber = elapsed.days + 1;
        } else {
            const diffMs = Date.now() - parsed.getTime();
            const safeDiff = diffMs < 0 ? 0 : diffMs;
            dayNumber = Math.floor(safeDiff / 86_400_000) + 1;
        }

        const safeDay = Number.isFinite(dayNumber) ? Math.max(1, dayNumber) : 1;
        const stage = getGerminationStageByDay(safeDay);
        if (!stage) return null;

        return {
            dayNumber: safeDay,
            stage,
            beyondDefinedRange: Boolean(stage.isBeyondDefinedRange),
        };
    }, [startTime, elapsed]);

    useEffect(() => {
        setElapsed(calculateElapsed(startTime));
    }, [startTime]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const loadStatus = async () => {
            setStatusLoading(true);
            setStatusError("");
            try {
                const status = await getGerminationStatus({ signal: controller.signal });
                if (cancelled) return;
                setStartTime(toLocalInputValueIfValid(status.startTime));
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.error("Failed to load germination status", error);
                setStatusError("Unable to load germination start time. Please try again.");
            } finally {
                if (!cancelled) {
                    setStatusLoading(false);
                }
            }
        };

        loadStatus();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

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

    const telemetryTopics = useMemo(() => {
        const keys = new Set();
        for (const topic of WS_TOPICS) {
            if (topic?.includes("telemetry")) {
                keys.add(topic);
            }
        }
        for (const topic of Object.keys(aggregatedTopics)) {
            if (topic?.includes("telemetry")) {
                keys.add(topic);
            }
        }
        keys.add("telemetry");
        keys.add("hydroleaf/telemetry");
        return Array.from(keys).filter(Boolean);
    }, [aggregatedTopics]);

    const isGerminationTelemetry = useMemo(() => {
        return (device) => {
            const rackId =
                (typeof device?.extra?.rackId === "string" && device.extra.rackId) ||
                (typeof device?.extra?.rack_id === "string" && device.extra.rack_id) ||
                (typeof device?.rackId === "string" && device.rackId) ||
                "";
            const deviceId = typeof device?.deviceId === "string" ? device.deviceId : "";

            return rackId === "S01-germination" || deviceId.startsWith("LOG-GER_");
        };
    }, []);

    const germinationDevices = useMemo(() => {
        const devices = {};
        telemetryTopics.forEach((topic) => {
            const topicDevices = aggregatedTopics[topic];
            if (!topicDevices) return;
            Object.entries(topicDevices).forEach(([id, device]) => {
                if (!isGerminationTelemetry(device)) return;
                devices[id] = device;
            });
        });
        return devices;
    }, [aggregatedTopics, isGerminationTelemetry, telemetryTopics]);

    const hasTopics = Object.keys(germinationDevices).length > 0;
    const deviceOptions = useMemo(
        () =>
            Object.entries(germinationDevices).map(([id, device]) => ({
                id,
                label:
                    device?.displayName ||
                    device?.deviceName ||
                    device?.compositeId ||
                    device?.name ||
                    id,
                sensors: device?.sensors || [],
            })),
        [germinationDevices],
    );

    useEffect(() => {
        if (!deviceOptions.length) {
            setSelectedCompositeId("");
            return;
        }
        if (!selectedCompositeId || !germinationDevices[selectedCompositeId]) {
            setSelectedCompositeId(deviceOptions[0].id);
        }
    }, [deviceOptions, germinationDevices, selectedCompositeId]);

    const availableMetrics = useMemo(() => {
        const device = germinationDevices[selectedCompositeId];
        if (!device) return [];

        const entries = new Map();
        (device.sensors || []).forEach((sensor) => {
            const measurementType = sensor?.sensorType || sensor?.valueType;
            if (!measurementType) return;
            const key = measurementType.toLowerCase();
            if (entries.has(key)) return;

            entries.set(key, {
                key,
                sensorType: measurementType,
                unit: sensor?.unit || "",
                label: measurementType,
            });
        });

        return Array.from(entries.values());
    }, [germinationDevices, selectedCompositeId]);

    useEffect(() => {
        if (!availableMetrics.length) {
            setSelectedMetricKey("");
            return;
        }
        const hasCurrent = availableMetrics.some((metric) => metric.key === selectedMetricKey);
        if (!hasCurrent) {
            setSelectedMetricKey(availableMetrics[0].key);
        }
    }, [availableMetrics, selectedMetricKey]);

    const selectedMetric = useMemo(() => {
        const metric = availableMetrics.find((entry) => entry.key === selectedMetricKey);
        if (!metric) return null;
        return {
            key: metric.key,
            sensorType: metric.sensorType,
            unit: metric.unit,
            label: metric.label,
        };
    }, [availableMetrics, selectedMetricKey]);

    const selectedMetricKeyValue = selectedMetric?.key ?? "";
    const selectedMetricSensorType = selectedMetric?.sensorType ?? "";

    const metricReports = useMemo(() => {
        if (!hasTopics) return [];

        const devices = germinationDevices || {};
        const compositeIds = Object.keys(devices);
        const entries = new Map();

        function sanitize(value) {
            if (value === undefined || value === null) return "";
            return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
        }

        compositeIds.forEach((compositeId) => {
            const { sensors = [], health = {}, compositeId: label } = devices[compositeId] || {};
            sensors.forEach((sensor) => {
                const measurementType = sensor?.sensorType || sensor?.valueType;
                const sensorModel = sensor?.sensorName || sensor?.source || "-";
                if (!measurementType) return;

                const normalizedType = sanitize(measurementType);
                const normalizedModel = sanitize(sensorModel) || normalizedType;
                const key = `${normalizedType}|${normalizedModel}`;

                if (!entries.has(key)) {
                    entries.set(key, {
                        measurementType,
                        sensorModel,
                        values: [],
                    });
                }

                const okKey = sensor?.sensorName?.toLowerCase();
                const rawHealth = okKey ? health[okKey] ?? health[sensor?.sensorName] : undefined;
                entries.get(key).values.push({
                    deviceId: label || compositeId,
                    rawValue: sensor?.value,
                    unit: sensor?.unit || "",
                    healthy:
                        rawHealth === undefined || rawHealth === null
                            ? null
                            : Boolean(rawHealth),
                });
            });
        });

        return Array.from(entries.values()).map((entry) => {
            const stageRange = stageDetails?.stage
                ? getStageRangeForMetric(entry.measurementType, stageDetails.stage)
                : null;
            const range = stageRange ?? null;

            const formattedValues = entry.values.map((value) => {
                const numericValue = typeof value.rawValue === "number" ? value.rawValue : Number(value.rawValue);
                const hasNumeric = !Number.isNaN(numericValue);
                return {
                    deviceId: value.deviceId,
                    displayValue:
                        value.rawValue === undefined || value.rawValue === null
                            ? "-"
                            : `${
                                  typeof value.rawValue === "number"
                                      ? value.rawValue.toFixed(1)
                                      : value.rawValue
                              }${value.unit ? ` ${value.unit}` : ""}`,
                    numericValue: hasNumeric ? numericValue : null,
                    healthy: value.healthy,
                };
            });

            const numericValues = formattedValues.filter((value) => value.numericValue !== null);
            const hasMin = range && typeof range.min === "number" && Number.isFinite(range.min);
            const hasMax = range && typeof range.max === "number" && Number.isFinite(range.max);
            const outOfRange =
                range && numericValues.length > 0
                    ? numericValues.some((value) => {
                          const val = value.numericValue;
                          if (val === null) return false;
                          if (hasMin && val < range.min) return true;
                          if (hasMax && val > range.max) return true;
                          return false;
                      })
                    : false;
            const tolerance = 0.01;
            const atBoundary =
                !outOfRange && range && numericValues.length > 0
                    ? numericValues.some((value) => {
                          const val = value.numericValue;
                          if (val === null) return false;
                          const nearMin =
                              hasMin && Math.abs(val - range.min) <= Math.max(Math.abs(range.min) * tolerance, tolerance);
                          const nearMax =
                              hasMax && Math.abs(val - range.max) <= Math.max(Math.abs(range.max) * tolerance, tolerance);
                          return nearMin || nearMax;
                      })
                    : false;
            const rangeStatus = !range || numericValues.length === 0
                ? "none"
                : outOfRange
                ? "alert"
                : atBoundary
                ? "warning"
                : "ok";
            const healthyValues = formattedValues.filter((value) => value.healthy === true);
            const unhealthyValues = formattedValues.filter((value) => value.healthy === false);
            const hasUnknown = formattedValues.some((value) => value.healthy === null);

            let status = "No data";
            let tone = "neutral";

            if (formattedValues.length === 0) {
                status = "No data";
                tone = "neutral";
            } else if (outOfRange) {
                status = "Out of range";
                tone = "alert";
            } else if (unhealthyValues.length > 0) {
                status = "Check sensors";
                tone = "warning";
            } else if (rangeStatus === "warning") {
                status = "Approaching limit";
                tone = "warning";
            } else if (healthyValues.length > 0 && !hasUnknown) {
                status = "Stable";
                tone = "success";
            } else {
                status = "Monitoring";
                tone = "neutral";
            }

            return {
                measurementType: entry.measurementType,
                sensorModel: entry.sensorModel,
                label: entry.measurementType,
                range,
                rangeStatus,
                stageDescription: range?.stageDescription ?? "",
                stageDaysLabel: range?.stageDaysLabel ?? "",
                stageBeyondDefinedRange: range?.stageBeyondDefinedRange ?? false,
                status,
                tone,
                values: formattedValues,
            };
        });
    }, [germinationDevices, hasTopics, stageDetails]);

    const handleStartChange = (event) => {
        setSaveMessage("");
        setSaveError("");
        setStatusError("");
        setStartTime(event.target.value);
    };

    const handleClearStart = () => {
        setSaveMessage("");
        setSaveError("");
        setStatusError("");
        setStartTime("");
    };

    const handleSaveStart = async () => {
        const parsed = parseLocalInput(startTime);
        if (startTime && !parsed) {
            setSaveMessage("");
            setSaveError("Please enter a valid start time before saving.");
            return;
        }

        const isoStart = parsed ? parsed.toISOString() : null;

        setSaving(true);
        setSaveMessage("");
        setSaveError("");
        setStatusError("");

        try {
            const status = await updateGerminationStart(isoStart);
            const normalized = toLocalInputValueIfValid(status.startTime);
            setStartTime(normalized);
            setSaveMessage(parsed || isoStart ? "Start time saved." : "Start time cleared.");
        } catch (error) {
            console.error("Failed to save germination start time", error);
            setSaveError("Unable to save start time. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleTriggerStart = async () => {
        setSaving(true);
        setSaveMessage("");
        setSaveError("");
        setStatusError("");

        try {
            const status = await triggerGerminationStart();
            const normalized = toLocalInputValueIfValid(status.startTime) || toLocalInputValue(new Date());
            setStartTime(normalized);
            setSaveMessage("Germination timer started.");
        } catch (error) {
            console.error("Failed to trigger germination start", error);
            setSaveError("Unable to start the germination timer. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = () => {
        if (rangePreset === "custom") {
            const nowValue = toLocalInputValue(new Date());
            setCustomTo(nowValue);
        }
        setRefreshIndex((value) => value + 1);
    };

    useEffect(() => {
        if (rangePreset !== "custom") return;
        if (customFrom && customTo) return;
        const { from, to } = getPresetRange("6h");
        setCustomFrom(toLocalInputValue(from));
        setCustomTo(toLocalInputValue(to));
    }, [rangePreset, customFrom, customTo]);

    useEffect(() => {
        if (!selectedCompositeId || !selectedMetricKeyValue) {
            setChartData([]);
            setChartDomain(null);
            return;
        }

        const range =
            rangePreset === "custom"
                ? (() => {
                      const fromDate = parseLocalInput(customFrom);
                      const toDate = parseLocalInput(customTo);
                      if (!fromDate || !toDate || fromDate >= toDate) return null;
                      return { from: fromDate, to: toDate };
                  })()
                : getPresetRange(rangePreset);

        if (!range) {
            setChartData([]);
            setChartDomain(null);
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const fetchHistory = async () => {
            setChartLoading(true);
            setChartError("");
            try {
                const params = new URLSearchParams({
                    compositeId: selectedCompositeId,
                    from: range.from.toISOString(),
                    to: range.to.toISOString(),
                });
                if (selectedMetricSensorType) {
                    params.append("sensorType", selectedMetricSensorType);
                }

                const response = await authFetch(`${API_BASE}/api/records/history/aggregated?${params.toString()}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                const json = await response.json();
                const entries = transformAggregatedData(json);
                const points = entries
                    .map((entry) => ({
                        time: entry.timestamp,
                        value: getEntryValue(entry, selectedMetricKeyValue),
                    }))
                    .filter((point) => point.value !== null);

                if (cancelled) return;
                setChartData(points);
                setChartDomain([range.from.getTime(), range.to.getTime()]);
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.error("Failed to load historical data", error);
                setChartError("Unable to load historical data. Please try again.");
                setChartData([]);
                setChartDomain([range.from.getTime(), range.to.getTime()]);
            } finally {
                if (!cancelled) {
                    setChartLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [
        customFrom,
        customTo,
        rangePreset,
        refreshIndex,
        selectedCompositeId,
        selectedMetricKeyValue,
        selectedMetricSensorType,
    ]);

    const selectedMetricLabel = selectedMetric?.label ?? "";
    const selectedMetricUnit = selectedMetric?.unit ?? "";
    const selectedMetricDisplayName =
        selectedMetricLabel || selectedMetricSensorType || selectedMetricKeyValue;

    const chartSeries = useMemo(() => {
        if (!selectedMetricKeyValue || chartData.length === 0) return [];
        return [
            {
                name: selectedMetricDisplayName,
                data: chartData,
                yDataKey: "value",
            },
        ];
    }, [chartData, selectedMetricDisplayName, selectedMetricKeyValue]);

    const chartYLabel = useMemo(() => {
        if (!selectedMetricKeyValue) return "";
        return selectedMetricUnit
            ? `${selectedMetricLabel} (${selectedMetricUnit})`
            : selectedMetricLabel || selectedMetricDisplayName;
    }, [selectedMetricDisplayName, selectedMetricKeyValue, selectedMetricLabel, selectedMetricUnit]);

    const timerFeedback = (() => {
        if (statusLoading) {
            return { type: "info", message: "Loading start time…" };
        }
        if (statusError) {
            return { type: "error", message: statusError };
        }
        if (saveError) {
            return { type: "error", message: saveError };
        }
        if (saveMessage) {
            return { type: "success", message: saveMessage };
        }
        return null;
    })();

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
                    <div className={styles.timerButtons}>
                        <button
                            type="button"
                            className={`${styles.timerButton} ${styles.startButton}`}
                            onClick={handleTriggerStart}
                            disabled={saving || statusLoading}
                        >
                            Start now
                        </button>
                        <button
                            type="button"
                            className={`${styles.timerButton} ${styles.saveButton}`}
                            onClick={handleSaveStart}
                            disabled={saving || statusLoading}
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            className={`${styles.timerButton} ${styles.clearButton}`}
                            onClick={handleClearStart}
                            disabled={saving || !startTime}
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {timerFeedback && (
                    <div className={styles.timerFeedback}>
                        <span
                            className={
                                timerFeedback.type === "error"
                                    ? styles.errorMessage
                                    : timerFeedback.type === "success"
                                    ? styles.successMessage
                                    : styles.infoMessage
                            }
                        >
                            {timerFeedback.message}
                        </span>
                    </div>
                )}
                <div className={styles.elapsedWrapper}>
                    <span className={styles.elapsedLabel}>Elapsed time</span>
                    <span className={styles.elapsedValue}>{formatElapsed(elapsed)}</span>
                </div>
                <div className={styles.stageSummary}>
                    {stageDetails ? (
                        <>
                            <span className={styles.stageSummaryLabel}>Current stage</span>
                            <div className={styles.stageSummaryContent}>
                                <span className={styles.stageSummaryName}>
                                    {stageDetails.stage.description}
                                </span>
                                <span className={styles.stageSummaryDays}>
                                    Day {stageDetails.dayNumber}
                                    {stageDetails.stage.daysLabel
                                        ? ` • Target window ${stageDetails.stage.daysLabel}`
                                        : ""}
                                    {stageDetails.beyondDefinedRange
                                        ? " • Beyond defined schedule"
                                        : ""}
                                </span>
                            </div>
                        </>
                    ) : (
                        <span className={styles.stageSummaryPlaceholder}>
                            Set a start time to see stage-based target ranges.
                        </span>
                    )}
                </div>
            </section>

            <section className={`${styles.sectionCard} ${styles.metricsSection}`}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Live sensors data</h2>
                </div>
                {metricReports.length > 0 ? (
                    <div className={styles.reportGrid}>
                        {metricReports.map((report) => {
                            const rangeClassName =
                                report.rangeStatus === "alert"
                                    ? styles.rangeAlert
                                    : report.rangeStatus === "warning"
                                    ? styles.rangeWarning
                                    : report.rangeStatus === "ok"
                                    ? styles.rangeOk
                                    : "";
                            const stageMeta = report.stageDescription
                                ? `${report.stageDescription}${
                                      report.stageDaysLabel ? ` • Days ${report.stageDaysLabel}` : ""
                                  }${report.stageBeyondDefinedRange ? " • Beyond schedule" : ""}`
                                : "";

                            const rangeLabelPrefix = stageMeta ? `Target range (${stageMeta})` : "Target range";
                            const minDisplay = formatRangeValue(report.range?.min);
                            const maxDisplay = formatRangeValue(report.range?.max);

                            return (
                                <article
                                    key={`${report.measurementType}-${report.sensorModel}`}
                                    className={`${styles.reportCard} ${styles[`${report.tone}Tone`]}`}
                                >
                                    <header className={styles.reportCardHeader}>
                                        <h3 className={styles.reportMetric}>{report.label}</h3>
                                        <span className={styles.reportStatus}>{report.status}</span>
                                    </header>
                                    <div className={styles.reportMeta}>
                                        <span className={styles.reportModel}>{report.sensorModel}</span>
                                        {report.range ? (
                                            <span className={`${styles.reportRange} ${rangeClassName}`}>
                                                {rangeLabelPrefix}: {minDisplay} - {maxDisplay}
                                            </span>
                                        ) : (
                                            <span className={styles.reportRange}>No configured range</span>
                                        )}
                                    </div>
                                    <ul className={styles.reportValues}>
                                        {report.values.map((value) => {
                                            const toneClass =
                                                value.healthy === true
                                                    ? styles.healthy
                                                    : value.healthy === false
                                                    ? styles.unhealthy
                                                    : styles.unknown;
                                            return (
                                                <li key={value.deviceId} className={styles.reportValueItem}>
                                                    <span className={`${styles.reportDot} ${toneClass}`} />
                                                    <span className={styles.reportDevice}>{value.deviceId}</span>
                                                    <span className={styles.reportValue}>{value.displayValue}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.emptyState}>No summary data available.</div>
                )}
            </section>

            <section className={`${styles.sectionCard} ${styles.chartSection}`}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Historical trends</h2>
                </div>
                {deviceOptions.length ? (
                    <div className={styles.chartControls}>
                        <div className={styles.chartSelectors}>
                            <label className={styles.chartLabel}>
                                Sensor node
                                <select
                                    className={styles.chartSelect}
                                    value={selectedCompositeId}
                                    onChange={(event) => setSelectedCompositeId(event.target.value)}
                                >
                                    {deviceOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={styles.chartLabel}>
                                Metric
                                <select
                                    className={styles.chartSelect}
                                    value={selectedMetricKey}
                                    onChange={(event) => setSelectedMetricKey(event.target.value)}
                                    disabled={!availableMetrics.length}
                                >
                                    {availableMetrics.map((metric) => (
                                        <option key={metric.key} value={metric.key}>
                                            {metric.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className={styles.rangeControls}>
                            <span className={styles.rangeLabel}>Range</span>
                            <div className={styles.rangeButtons}>
                                {RANGE_OPTIONS.map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        className={`${styles.rangeButton} ${
                                            rangePreset === option.key ? styles.rangeButtonActive : ""
                                        }`}
                                        onClick={() => setRangePreset(option.key)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {rangePreset === "custom" && (
                            <div className={styles.customRangeInputs}>
                                <label className={styles.chartLabel}>
                                    From
                                    <input
                                        type="datetime-local"
                                        value={customFrom}
                                        onChange={(event) => setCustomFrom(event.target.value)}
                                        className={styles.timeInput}
                                        max={customTo || undefined}
                                    />
                                </label>
                                <label className={styles.chartLabel}>
                                    To
                                    <input
                                        type="datetime-local"
                                        value={customTo}
                                        onChange={(event) => setCustomTo(event.target.value)}
                                        className={styles.timeInput}
                                        min={customFrom || undefined}
                                    />
                                </label>
                            </div>
                        )}
                        <button
                            type="button"
                            className={styles.refreshButton}
                            onClick={handleRefresh}
                        >
                            Refresh
                        </button>
                    </div>
                ) : (
                    <div className={styles.emptyState}>No germination nodes available for history.</div>
                )}

                {chartError && <div className={styles.errorMessage}>{chartError}</div>}

                <div className={styles.chartArea}>
                    {chartLoading ? (
                        <div className={styles.chartMessage}>Loading historical data…</div>
                    ) : chartSeries.length ? (
                        <HistoryChart
                            xDataKey="time"
                            series={chartSeries}
                            yLabel={chartYLabel}
                            xDomain={chartDomain}
                        />
                    ) : (
                        <div className={styles.chartMessage}>
                            Select a sensor and metric to view historical trends.
                        </div>
                    )}
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
        </div>
    );
}
