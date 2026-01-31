import React, { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import HistoryChart from "../../../components/HistoryChart.jsx";
import styles from "../../Germination/Germination.module.css";
import { getPresetRange } from "../../Germination/germinationUtils.js";
import { useLiveTelemetry } from "../../Germination/hooks/useLiveTelemetry.js";
import { deviceMatchesRack, normalizeRackId, resolveDeviceSelectionKey } from "../rackTelemetry.js";
import { fetchHistorical } from "../services/historical.js";

const AS7343_PREFIX = "as7343_counts_";

const AS7343_GROUPS = [
    {
        id: "blue",
        label: "Blue",
        color: "#5b7cff",
        keys: [
            "as7343_counts_405nm",
            "as7343_counts_425nm",
            "as7343_counts_450nm",
            "as7343_counts_475nm",
        ],
    },
    {
        id: "green",
        label: "Green",
        color: "#4fd38a",
        keys: ["as7343_counts_515nm", "as7343_counts_550nm", "as7343_counts_555nm"],
    },
    {
        id: "red",
        label: "Red",
        color: "#ff6f5f",
        keys: ["as7343_counts_600nm", "as7343_counts_640nm", "as7343_counts_690nm"],
    },
];

const RANGE_OPTIONS = [
    { key: "1h", label: "Last 60 minutes" },
    { key: "24h", label: "Last 24 hours" },
];

const ALL_CHANNEL_KEYS = AS7343_GROUPS.flatMap((group) => group.keys);

const hasAs7343Sensor = (sensor) =>
    /as7343/i.test(sensor?.sensorName || "") || /as7343/i.test(sensor?.source || "");

const toHistoryKey = (measurementType) =>
    measurementType ? `${AS7343_PREFIX}${measurementType}` : null;

const formatCount = (value) => {
    if (!Number.isFinite(value)) return "-";
    return Math.round(value).toLocaleString();
};

const formatPercent = (value) => {
    if (!Number.isFinite(value)) return "-";
    return `${value.toFixed(1)}%`;
};

const SpectrumBalanceTooltip = ({ active, payload, label, formatter }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
        <div
            style={{
                backgroundColor: "rgba(7, 15, 32, 0.94)",
                border: "1px solid #31507f",
                borderRadius: 8,
                color: "#e4ecff",
                boxShadow: "0 12px 28px rgba(4, 11, 26, 0.55)",
                padding: "0.75rem 0.9rem",
            }}
        >
            <div style={{ color: "#9fb6ff", marginBottom: "0.4rem", fontWeight: 600 }}>
                {formatter ? formatter(label) : label}
            </div>
            {AS7343_GROUPS.map((group) => (
                <div key={group.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <span style={{ color: group.color }}>{group.label}</span>
                    <span>
                        {formatPercent(data[`${group.id}Pct`])} ({formatCount(data[`${group.id}Total`])} counts)
                    </span>
                </div>
            ))}
        </div>
    );
};

export default function As7343TrendsPanel({ rackId, selectedDeviceIds }) {
    const normalizedRackId = normalizeRackId(rackId);
    const [selectedCompositeId, setSelectedCompositeId] = useState("");
    const [rangePreset, setRangePreset] = useState("1h");
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [chartLoading, setChartLoading] = useState(false);
    const [chartError, setChartError] = useState("");
    const [channelHistory, setChannelHistory] = useState({});
    const [chartDomain, setChartDomain] = useState(null);

    const selectedSet = useMemo(() => {
        if (!Array.isArray(selectedDeviceIds) || selectedDeviceIds.length === 0) return null;
        return new Set(selectedDeviceIds.map((value) => String(value).trim()));
    }, [selectedDeviceIds]);

    const filterDevice = useMemo(() => {
        return (device) => {
            if (!deviceMatchesRack(device, normalizedRackId)) return false;
            if (!selectedSet) return true;

            const id = resolveDeviceSelectionKey(device);
            return Boolean(id) && selectedSet.has(id);
        };
    }, [normalizedRackId, selectedSet]);

    const { devices, deviceOptions } = useLiveTelemetry({ filterDevice });

    const as7343DeviceOptions = useMemo(
        () => deviceOptions.filter((option) => option.sensors?.some(hasAs7343Sensor)),
        [deviceOptions],
    );

    useEffect(() => {
        if (!as7343DeviceOptions.length) {
            setSelectedCompositeId("");
            return;
        }
        if (!selectedCompositeId || !devices[selectedCompositeId]) {
            setSelectedCompositeId(as7343DeviceOptions[0].id);
        }
    }, [as7343DeviceOptions, devices, selectedCompositeId]);

    useEffect(() => {
        if (!selectedCompositeId) return;
        const stillExists = as7343DeviceOptions.some((opt) => opt.id === selectedCompositeId);
        if (!stillExists) setSelectedCompositeId("");
    }, [as7343DeviceOptions, selectedCompositeId]);

    const deviceSensors = devices[selectedCompositeId]?.sensors || [];

    const availableChannelKeys = useMemo(() => {
        const keys = new Set();
        deviceSensors.forEach((sensor) => {
            if (!hasAs7343Sensor(sensor)) return;
            const measurementType = sensor?.sensorType || sensor?.valueType;
            const historyKey = toHistoryKey(measurementType);
            if (historyKey) keys.add(historyKey);
        });
        return keys;
    }, [deviceSensors]);

    const missingChannelKeys = useMemo(
        () => ALL_CHANNEL_KEYS.filter((key) => !availableChannelKeys.has(key)),
        [availableChannelKeys],
    );

    const hasPartialSpectrum = Boolean(selectedCompositeId) && missingChannelKeys.length > 0;
    const missingRedChannels =
        Boolean(selectedCompositeId) &&
        missingChannelKeys.some((key) =>
            AS7343_GROUPS.find((group) => group.id === "red")?.keys.includes(key),
        );

    const handleRefresh = () => setRefreshIndex((value) => value + 1);

    useEffect(() => {
        if (!normalizedRackId || !selectedCompositeId) {
            setChannelHistory({});
            setChartDomain(null);
            return;
        }

        const range = getPresetRange(rangePreset);
        let cancelled = false;
        const controller = new AbortController();

        const fetchData = async () => {
            setChartLoading(true);
            setChartError("");
            try {
                const entries = await Promise.all(
                    ALL_CHANNEL_KEYS.map(async (metricKey) => {
                        const points = await fetchHistorical({
                            rackId: normalizedRackId,
                            nodeId: selectedCompositeId,
                            metricKey,
                            sensorType: metricKey,
                            from: range.from,
                            to: range.to,
                            signal: controller.signal,
                        });
                        return [metricKey, points];
                    }),
                );
                if (cancelled) return;
                const nextHistory = entries.reduce((acc, [metricKey, points]) => {
                    acc[metricKey] = points;
                    return acc;
                }, {});
                setChannelHistory(nextHistory);
                setChartDomain([range.from.getTime(), range.to.getTime()]);
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.error("Failed to load AS7343 history", error);
                setChartError("Unable to load AS7343 spectrum history. Please try again.");
                setChannelHistory({});
                setChartDomain([range.from.getTime(), range.to.getTime()]);
            } finally {
                if (!cancelled) {
                    setChartLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [normalizedRackId, rangePreset, refreshIndex, selectedCompositeId]);

    const formatTimestamp = useMemo(() => {
        const formatter = new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        return (value) => {
            if (value === undefined || value === null) return "";
            const input = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(input.getTime())) return "";
            return formatter.format(input);
        };
    }, []);

    const mergedPoints = useMemo(() => {
        const pointMap = new Map();
        Object.entries(channelHistory).forEach(([metricKey, points]) => {
            if (!Array.isArray(points)) return;
            points.forEach((point) => {
                const time = point?.time;
                if (!Number.isFinite(time)) return;
                const existing = pointMap.get(time) ?? { time };
                existing[metricKey] = point.value;
                pointMap.set(time, existing);
            });
        });

        return Array.from(pointMap.values())
            .sort((a, b) => a.time - b.time)
            .map((point) => {
                const totals = {};
                let hasFullSpectrum = true;
                AS7343_GROUPS.forEach((group) => {
                    const values = group.keys.map((key) => point[key]);
                    const hasAll = values.every((value) => typeof value === "number" && Number.isFinite(value));
                    if (!hasAll) {
                        hasFullSpectrum = false;
                    }
                    totals[group.id] = hasAll ? values.reduce((sum, value) => sum + value, 0) : null;
                });

                const total =
                    hasFullSpectrum && totals.blue !== null && totals.green !== null && totals.red !== null
                        ? totals.blue + totals.green + totals.red
                        : null;

                if (!Number.isFinite(total) || total <= 0) {
                    return {
                        time: point.time,
                        blueTotal: totals.blue,
                        greenTotal: totals.green,
                        redTotal: totals.red,
                        total: null,
                        bluePct: null,
                        greenPct: null,
                        redPct: null,
                    };
                }

                return {
                    time: point.time,
                    blueTotal: totals.blue,
                    greenTotal: totals.green,
                    redTotal: totals.red,
                    total,
                    bluePct: (totals.blue / total) * 100,
                    greenPct: (totals.green / total) * 100,
                    redPct: (totals.red / total) * 100,
                };
            });
    }, [channelHistory]);

    const balanceData = useMemo(
        () => mergedPoints.filter((point) => Number.isFinite(point.total)),
        [mergedPoints],
    );

    const ratioData = useMemo(
        () =>
            balanceData
                .map((point) => {
                    if (!Number.isFinite(point.redTotal) || point.redTotal <= 0) return null;
                    const ratio = point.blueTotal / point.redTotal;
                    return {
                        time: point.time,
                        ratio: Number(ratio.toFixed(2)),
                    };
                })
                .filter(Boolean),
        [balanceData],
    );

    const ratioSeries = useMemo(() => {
        if (!ratioData.length) return [];
        return [
            {
                name: "Blue : Red",
                data: ratioData,
                yDataKey: "ratio",
                color: "#7fa6ff",
            },
        ];
    }, [ratioData]);

    const hasDevices = as7343DeviceOptions.length > 0;
    const hasSelection = Boolean(selectedCompositeId);
    const emptyMessage = hasSelection
        ? "No spectrum data available for the selected range."
        : "Select an AS7343 sensor node to view spectrum history.";

    if (!hasDevices) {
        return null;
    }

    return (
        <section className={`${styles.sectionCard} ${styles.chartSection}`}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>AS7343 Spectrum Balance</h2>
                {hasPartialSpectrum && (
                    <span className={`${styles.spectrumBadge} ${styles.spectrumBadgeWarning}`}>
                        Partial spectrum
                    </span>
                )}
            </div>
            <div className={styles.chartControls}>
                <div className={styles.chartSelectors}>
                    <label className={styles.chartLabel}>
                        Sensor node
                        <select
                            className={styles.chartSelect}
                            value={selectedCompositeId}
                            onChange={(event) => setSelectedCompositeId(event.target.value)}
                        >
                            {as7343DeviceOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
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
                <button type="button" className={styles.refreshButton} onClick={handleRefresh}>
                    Refresh
                </button>
            </div>

            {chartError && <div className={styles.errorMessage}>{chartError}</div>}

            <div className={styles.spectrumCharts}>
                <div className={styles.chartArea}>
                    {chartLoading ? (
                        <div className={styles.chartMessage}>Loading spectrum balance…</div>
                    ) : balanceData.length ? (
                        <ResponsiveContainer width="100%" height={320} debounce={200}>
                            <BarChart
                                data={balanceData}
                                margin={{ top: 20, right: 30, left: 12, bottom: 50 }}
                                barGap={4}
                                barCategoryGap={6}
                                isAnimationActive={false}
                            >
                                <CartesianGrid stroke="#1f2a44" strokeDasharray="4 4" />
                                <XAxis
                                    dataKey="time"
                                    type="number"
                                    scale="time"
                                    domain={chartDomain ?? ["auto", "auto"]}
                                    tickFormatter={formatTimestamp}
                                    stroke="#2b3c5c"
                                    tick={{ fontSize: 12, fill: "#1f2d4d", fontWeight: 500 }}
                                    angle={-20}
                                    textAnchor="end"
                                    height={60}
                                    allowDataOverflow
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 12, fill: "#1f2d4d", fontWeight: 500 }}
                                    stroke="#2b3c5c"
                                    tickLine={{ stroke: "#2b3c5c" }}
                                />
                                <Tooltip
                                    cursor={{ fill: "rgba(111, 155, 255, 0.15)" }}
                                    content={
                                        <SpectrumBalanceTooltip
                                            formatter={formatTimestamp}
                                        />
                                    }
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: 12, color: "#d0dcff" }}
                                />
                                {AS7343_GROUPS.map((group) => (
                                    <Bar
                                        key={group.id}
                                        dataKey={`${group.id}Pct`}
                                        name={group.label}
                                        stackId="balance"
                                        fill={group.color}
                                        isAnimationActive={false}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className={styles.chartMessage}>{emptyMessage}</div>
                    )}
                </div>

                <div className={styles.chartArea}>
                    {chartLoading ? (
                        <div className={styles.chartMessage}>Loading Blue : Red ratio…</div>
                    ) : missingRedChannels ? (
                        <div className={styles.chartMessage}>Insufficient data (missing red channels).</div>
                    ) : !ratioSeries.length ? (
                        <div className={styles.chartMessage}>No ratio data available for this range.</div>
                    ) : (
                        <HistoryChart
                            xDataKey="time"
                            series={ratioSeries}
                            yLabel="Blue : Red ratio"
                            xDomain={chartDomain}
                            showLegend={false}
                        />
                    )}
                </div>
            </div>
            <div className={styles.spectrumNote}>
                Ratio trends are meaningful, but raw counts are not calibrated. Hover for raw values.
            </div>
        </section>
    );
}
