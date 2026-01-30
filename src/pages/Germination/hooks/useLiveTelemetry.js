import { useEffect, useMemo, useState } from "react";
import { useLiveDevices } from "../../common/useLiveDevices";
import { buildAggregatedTopics, resolveTelemetryTopics } from "../../common/liveTelemetry.js";
import { getStageRangeForMetric } from "../germinationStages.js";
import { TELEMETRY_ENDPOINTS } from "../../../config/telemetryEndpoints.js";
import { DEFAULT_STALE_THRESHOLD_MS } from "../../../config/telemetryStatus.js";
import { formatNodeOptionLabel, formatNodeSubtitle, formatNodeTitle, getDeviceDebugId } from "../../common/telemetryLabels.js";

const defaultFilter = () => true;

export function useLiveTelemetry({
    stageDetails = null,
    topics = TELEMETRY_ENDPOINTS.ws.topics,
    filterDevice = defaultFilter,
    staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
} = {}) {
    const { deviceData, mergedDevices } = useLiveDevices(topics);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    const aggregatedTopics = useMemo(() => buildAggregatedTopics(deviceData), [deviceData]);

    const telemetryTopics = useMemo(() => {
        return resolveTelemetryTopics(topics, aggregatedTopics);
    }, [aggregatedTopics, topics]);

    const isIncluded = useMemo(() => filterDevice, [filterDevice]);

    const filteredDevices = useMemo(() => {
        const devices = {};
        telemetryTopics.forEach((topic) => {
            const topicDevices = aggregatedTopics[topic];
            if (!topicDevices) return;
            Object.entries(topicDevices).forEach(([id, device]) => {
                if (!isIncluded(device)) return;
                devices[id] = mergedDevices?.[id] || device;
            });
        });
        return devices;
    }, [aggregatedTopics, isIncluded, mergedDevices, telemetryTopics]);

    const deviceOptions = useMemo(
        () =>
            Object.entries(filteredDevices).map(([id, device]) => ({
                id,
                label: formatNodeOptionLabel(device),
                sensors: device?.sensors || [],
            })),
        [filteredDevices],
    );

    const hasTopics = Object.keys(filteredDevices).length > 0;

    const metricReports = useMemo(() => {
        if (!hasTopics) return [];

        const devices = filteredDevices || {};
        const compositeIds = Object.keys(devices);
        const entries = new Map();

        function sanitize(value) {
            if (value === undefined || value === null) return "";
            return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
        }

        compositeIds.forEach((compositeId) => {
            const device = devices[compositeId] || {};
            const { sensors = [], health = {} } = device;
            const title = formatNodeTitle(device);
            const subtitle = formatNodeSubtitle(device);
            const debugId = getDeviceDebugId(device);
            const timestamp = device?.timestamp || device?.receivedAt || 0;
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
                        sensorType: sensor?.sensorType ?? measurementType,
                        sensorModel,
                        values: [],
                    });
                }

                const okKey = sensor?.sensorName?.toLowerCase();
                const rawHealth = okKey ? health[okKey] ?? health[sensor?.sensorName] : undefined;
                entries.get(key).values.push({
                    id: compositeId,
                    title,
                    subtitle,
                    debugId,
                    rawValue: sensor?.value,
                    unit: sensor?.unit || "",
                    timestamp,
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
                const ageMs = value.timestamp ? now - value.timestamp : Number.POSITIVE_INFINITY;
                const status =
                    value.healthy === false
                        ? "ERROR"
                        : ageMs > staleThresholdMs
                        ? "STALE"
                        : "OK";
                return {
                    id: value.id,
                    title: value.title,
                    subtitle: value.subtitle,
                    debugId: value.debugId,
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
                    status,
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
                sensorType: entry.sensorType,
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
    }, [filteredDevices, hasTopics, now, stageDetails, staleThresholdMs]);

    return {
        devices: filteredDevices,
        deviceOptions,
        hasTopics,
        metricReports,
    };
}
