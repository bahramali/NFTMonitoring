import React, { useEffect, useMemo, useState } from "react";
import Header from "../common/Header";
import GerminationCamera from "./components/GerminationCamera";
import {
    getGerminationStatus,
    triggerGerminationStart,
    updateGerminationStart,
} from "../../api/germination.js";
import { getGerminationStageByDay } from "./germinationStages.js";
import { useLiveTelemetry } from "./hooks/useLiveTelemetry.js";
import { fetchHistorical } from "./services/historical.js";
import LiveSensorsPanel from "./components/LiveSensorsPanel.jsx";
import HistoricalTrendsPanel from "./components/HistoricalTrendsPanel.jsx";
import {
    getPresetRange,
    parseLocalInput,
    toLocalInputValue,
} from "./germinationUtils.js";
import styles from "./Germination.module.css";

const RANGE_OPTIONS = [
    { key: "1h", label: "Last hour" },
    { key: "6h", label: "Last 6 hours" },
    { key: "24h", label: "Last 24 hours" },
    { key: "custom", label: "Custom" },
];

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
    const isGerminationTelemetry = useMemo(() => {
        return (device) => {
            const rackId =
                (typeof device?.extra?.rackId === "string" && device.extra.rackId) ||
                (typeof device?.extra?.rack_id === "string" && device.extra.rack_id) ||
                (typeof device?.rackId === "string" && device.rackId) ||
                (typeof device?.rack === "string" && device.rack) ||
                "";
            const rack = typeof device?.rack === "string" ? device.rack.toLowerCase() : "";
            const deviceId = typeof device?.deviceId === "string" ? device.deviceId : "";
            const mqttTopic = typeof device?.mqttTopic === "string" ? device.mqttTopic.toLowerCase() : "";

            const normalizedRack = rackId.toLowerCase();
            return (
                normalizedRack === "s01-germination" ||
                normalizedRack.includes("germination") ||
                rack.includes("germination") ||
                mqttTopic.includes("germination") ||
                deviceId.startsWith("LOG-GER_") ||
                deviceId.startsWith("GER_") ||
                deviceId.includes("GER-")
            );
        };
    }, []);
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

    const { devices: germinationDevices, deviceOptions, metricReports } = useLiveTelemetry({
        stageDetails,
        filterDevice: isGerminationTelemetry,
    });

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
                const points = await fetchHistorical({
                    compositeId: selectedCompositeId,
                    from: range.from,
                    to: range.to,
                    sensorType: selectedMetricSensorType,
                    metricKey: selectedMetricKeyValue,
                    signal: controller.signal,
                });
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

            <LiveSensorsPanel metricReports={metricReports} />

            <HistoricalTrendsPanel
                deviceOptions={deviceOptions}
                selectedCompositeId={selectedCompositeId}
                onCompositeChange={setSelectedCompositeId}
                availableMetrics={availableMetrics}
                selectedMetricKey={selectedMetricKey}
                onMetricChange={setSelectedMetricKey}
                rangePreset={rangePreset}
                rangeOptions={RANGE_OPTIONS}
                onRangePreset={setRangePreset}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFrom={setCustomFrom}
                onCustomTo={setCustomTo}
                onRefresh={handleRefresh}
                chartError={chartError}
                chartLoading={chartLoading}
                chartSeries={chartSeries}
                chartYLabel={chartYLabel}
                chartDomain={chartDomain}
            />

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
