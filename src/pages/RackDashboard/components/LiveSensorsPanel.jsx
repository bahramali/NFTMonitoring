import React, { useMemo, useState } from "react";
import GerminationLiveSensorsPanel from "../../Germination/components/LiveSensorsPanel.jsx";
import styles from "../../Germination/Germination.module.css";
import { useLiveTelemetry } from "../../Germination/hooks/useLiveTelemetry.js";
import { deviceMatchesRack, normalizeRackId } from "../rackTelemetry.js";

const AS7343_PREFIX = "as7343_counts_";
const AS7343_GROUPS = [
    {
        id: "blue",
        label: "Blue intensity",
        keys: [
            "as7343_counts_405nm",
            "as7343_counts_425nm",
            "as7343_counts_450nm",
            "as7343_counts_475nm",
        ],
        tone: "neutral",
    },
    {
        id: "green",
        label: "Green balance",
        keys: ["as7343_counts_515nm", "as7343_counts_550nm", "as7343_counts_555nm"],
        tone: "neutral",
    },
    {
        id: "red",
        label: "Red intensity",
        keys: ["as7343_counts_600nm", "as7343_counts_640nm", "as7343_counts_690nm"],
        tone: "neutral",
    },
    {
        id: "far-red",
        label: "Far-Red / IR",
        keys: ["as7343_counts_745nm", "as7343_counts_855nm"],
        tone: "alert",
    },
];

const SUMMARY_SENSOR_MODEL = "AS7343 summary";

const buildSummaryReports = (metricReports) => {
    const asReports = metricReports.filter((report) => report.measurementType?.startsWith?.(AS7343_PREFIX));
    if (asReports.length === 0) {
        return { summaryReports: [], hasAs7343: false, totalsByGroup: new Map() };
    }

    const reportsByType = new Map();
    const deviceMeta = new Map();

    asReports.forEach((report) => {
        const valueMap = new Map();
        report.values.forEach((value) => {
            valueMap.set(value.id, value);
            if (!deviceMeta.has(value.id)) {
                deviceMeta.set(value.id, {
                    title: value.title,
                    subtitle: value.subtitle,
                    debugId: value.debugId,
                });
            }
        });
        reportsByType.set(report.measurementType, valueMap);
    });

    const totalsByGroup = new Map();

    const summaryReports = AS7343_GROUPS.map((group) => {
        let isPartial = false;
        const groupTotals = new Map();
        const values = Array.from(deviceMeta.entries()).map(([deviceId, meta]) => {
            let total = 0;
            let hasValue = false;
            let hasError = false;
            let hasStale = false;
            let healthy = null;

            group.keys.forEach((key) => {
                const valueMap = reportsByType.get(key);
                if (!valueMap) {
                    isPartial = true;
                    return;
                }
                const value = valueMap.get(deviceId);
                if (!value || value.numericValue === null) {
                    isPartial = true;
                    return;
                }
                hasValue = true;
                total += value.numericValue;
                if (value.status === "ERROR") hasError = true;
                if (value.status === "STALE") hasStale = true;
                if (value.healthy === false) {
                    healthy = false;
                } else if (value.healthy === true && healthy !== false) {
                    healthy = true;
                }
            });

            let status = "STALE";
            if (hasValue) {
                status = hasError ? "ERROR" : hasStale ? "STALE" : "OK";
            }

            groupTotals.set(deviceId, { total: hasValue ? total : null, status, healthy });

            return {
                id: deviceId,
                title: meta.title,
                subtitle: meta.subtitle,
                debugId: meta.debugId,
                displayValue: hasValue ? total.toFixed(1) : "-",
                numericValue: hasValue ? total : null,
                healthy,
                status,
            };
        });

        totalsByGroup.set(group.id, groupTotals);

        return {
            measurementType: `as7343_summary_${group.id}`,
            sensorModel: SUMMARY_SENSOR_MODEL,
            label: isPartial ? `${group.label} (partial)` : group.label,
            range: null,
            rangeStatus: "none",
            stageDescription: "",
            stageDaysLabel: "",
            stageBeyondDefinedRange: false,
            status: "Monitoring",
            tone: group.tone,
            values,
        };
    });

    const ratioValues = Array.from(deviceMeta.entries()).map(([deviceId, meta]) => {
        const blueTotals = totalsByGroup.get("blue");
        const redTotals = totalsByGroup.get("red");
        const blueValue = blueTotals?.get(deviceId);
        const redValue = redTotals?.get(deviceId);
        const hasInputs = blueValue?.total !== null && redValue?.total !== null;
        const ratio =
            hasInputs && redValue.total !== 0 ? blueValue.total / redValue.total : null;
        const hasError = [blueValue?.status, redValue?.status].includes("ERROR");
        const hasStale = [blueValue?.status, redValue?.status].includes("STALE");

        let status = "STALE";
        if (ratio !== null) {
            status = hasError ? "ERROR" : hasStale ? "STALE" : "OK";
        }

        let healthy = null;
        if (blueValue?.healthy === false || redValue?.healthy === false) {
            healthy = false;
        } else if (blueValue?.healthy === true || redValue?.healthy === true) {
            healthy = true;
        }

        return {
            id: deviceId,
            title: meta.title,
            subtitle: meta.subtitle,
            debugId: meta.debugId,
            displayValue: ratio !== null ? ratio.toFixed(2) : "-",
            numericValue: ratio,
            healthy,
            status,
        };
    });

    summaryReports.push({
        measurementType: "as7343_summary_ratio_blue_red",
        sensorModel: SUMMARY_SENSOR_MODEL,
        label: "Blue : Red",
        range: null,
        rangeStatus: "none",
        stageDescription: "",
        stageDaysLabel: "",
        stageBeyondDefinedRange: false,
        status: "Monitoring",
        tone: "neutral",
        values: ratioValues,
    });

    return { summaryReports, hasAs7343: true };
};

export default function LiveSensorsPanel({ rackId }) {
    const normalizedRackId = normalizeRackId(rackId);
    const [showAdvancedSpectrum, setShowAdvancedSpectrum] = useState(false);

    const filterDevice = useMemo(() => {
        return (device) => deviceMatchesRack(device, normalizedRackId);
    }, [normalizedRackId]);

    const { metricReports } = useLiveTelemetry({ filterDevice });
    const { summaryReports, hasAs7343 } = useMemo(() => buildSummaryReports(metricReports), [metricReports]);

    const visibleReports = useMemo(() => {
        if (!hasAs7343) {
            return metricReports;
        }
        const filteredReports = showAdvancedSpectrum
            ? metricReports
            : metricReports.filter((report) => !report.measurementType?.startsWith?.(AS7343_PREFIX));
        return [...summaryReports, ...filteredReports];
    }, [hasAs7343, metricReports, showAdvancedSpectrum, summaryReports]);

    const headerActions = hasAs7343 ? (
        <label className={styles.headerToggle}>
            <span className={styles.headerToggleLabel}>Advanced spectrum (nm)</span>
            <input
                type="checkbox"
                className={styles.headerToggleInput}
                checked={showAdvancedSpectrum}
                onChange={(event) => setShowAdvancedSpectrum(event.target.checked)}
            />
        </label>
    ) : null;

    return <GerminationLiveSensorsPanel metricReports={visibleReports} headerActions={headerActions} />;
}
