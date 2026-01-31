import React, { useEffect, useMemo, useState } from "react";
import GerminationHistoricalTrendsPanel from "../../Germination/components/HistoricalTrendsPanel.jsx";
import { fetchHistorical } from "../services/historical.js";
import { getPresetRange, parseLocalInput, toLocalInputValue } from "../../Germination/germinationUtils.js";
import { useLiveTelemetry } from "../../Germination/hooks/useLiveTelemetry.js";
import { deviceMatchesRack, normalizeRackId } from "../rackTelemetry.js";

const RANGE_OPTIONS = [
    { key: "1h", label: "Last hour" },
    { key: "6h", label: "Last 6 hours" },
    { key: "24h", label: "Last 24 hours" },
    { key: "custom", label: "Custom" },
];

export default function HistoricalTrendsPanel({ rackId, selectedDeviceIds }) {
    const normalizedRackId = normalizeRackId(rackId);

    const selectedSet = useMemo(() => {
        if (!Array.isArray(selectedDeviceIds) || selectedDeviceIds.length === 0) return null;
        return new Set(selectedDeviceIds.map((value) => String(value).trim()));
    }, [selectedDeviceIds]);

    const filterDevice = useMemo(() => {
        return (device) => {
            if (!deviceMatchesRack(device, normalizedRackId)) return false;
            if (!selectedSet) return true;

            const id = String(device?.deviceId || device?.compositeId || "").trim();
            return Boolean(id) && selectedSet.has(id);
        };
    }, [normalizedRackId, selectedSet]);

    const { devices, deviceOptions } = useLiveTelemetry({ filterDevice });
    const [selectedCompositeId, setSelectedCompositeId] = useState("");
    const [selectedMetricKey, setSelectedMetricKey] = useState("");
    const [rangePreset, setRangePreset] = useState("1h");
    const [customFrom, setCustomFrom] = useState(() => {
        const now = new Date();
        const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        return toLocalInputValue(start);
    });
    const [customTo, setCustomTo] = useState(() => toLocalInputValue(new Date()));
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [chartData, setChartData] = useState([]);
    const [chartDomain, setChartDomain] = useState(null);
    const [chartError, setChartError] = useState("");
    const [chartLoading, setChartLoading] = useState(false);

    useEffect(() => {
        setSelectedCompositeId("");
        setSelectedMetricKey("");
        setChartData([]);
        setChartDomain(null);
    }, [normalizedRackId]);

    useEffect(() => {
        if (!deviceOptions.length) {
            setSelectedCompositeId("");
            return;
        }
        if (!selectedCompositeId || !devices[selectedCompositeId]) {
            setSelectedCompositeId(deviceOptions[0].id);
        }
    }, [deviceOptions, devices, selectedCompositeId]);

    const availableMetrics = useMemo(() => {
        const device = devices[selectedCompositeId];
        if (!device) return [];

        const entries = new Map();
        (device.sensors || []).forEach((sensor) => {
            const measurementType = sensor?.sensorType || sensor?.valueType;
            if (!measurementType) return;
            const key = measurementType.toLowerCase();
            if (entries.has(key)) return;
            const sensorName = sensor?.sensorName || sensor?.source;
            const isAs7343 = sensorName && sensorName.toLowerCase() === "as7343";
            const historyKey = isAs7343 ? `as7343_counts_${measurementType}` : measurementType;
            const label =
                isAs7343
                    ? `AS7343 ${measurementType}`
                    : measurementType;

            entries.set(key, {
                key,
                sensorType: historyKey,
                unit: sensor?.unit || "",
                label,
                historyKey,
            });
        });

        return Array.from(entries.values());
    }, [devices, selectedCompositeId]);

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
            historyKey: metric.historyKey,
        };
    }, [availableMetrics, selectedMetricKey]);

    const selectedMetricKeyValue = selectedMetric?.key ?? "";
    const selectedMetricSensorType = selectedMetric?.sensorType ?? "";
    const selectedMetricHistoryKey = selectedMetric?.historyKey ?? selectedMetricKeyValue;

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
        if (!normalizedRackId || !selectedCompositeId || !selectedMetricKeyValue) {
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
                    rackId: normalizedRackId,
                    nodeId: selectedCompositeId,
                    metricKey: selectedMetricHistoryKey,
                    sensorType: selectedMetricSensorType,
                    from: range.from,
                    to: range.to,
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
        normalizedRackId,
        rangePreset,
        refreshIndex,
        selectedCompositeId,
        selectedMetricHistoryKey,
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

    return (
        <GerminationHistoricalTrendsPanel
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
            emptyStateMessage="No sensors available for this rack yet."
        />
    );
}
