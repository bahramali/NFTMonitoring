import React, { useMemo } from "react";
import HistoryChart from "../../../components/HistoryChart";
import spectralColors from "../../../spectralColors";
import styles from "./ReportCharts.module.css";

// English comments: helper to convert {cid: data[]} to multi-series spec
const toSeries = (byCid, yKey) =>
    Object.entries(byCid || {}).map(([cid, data]) => ({
        name: cid,
        data,
        yDataKey: yKey,
    }));

// English comments: build series for multiple spectrum keys across CIDs
const toSpectrumSeries = (byCid, keys = []) =>
    Object.entries(byCid || {}).flatMap(([cid, data]) =>
        keys.map((k) => ({ name: `${cid} ${k}`, data, yDataKey: k, color: spectralColors[k] || undefined }))
    );

const withDevice = (title, selectedDevice) =>
    selectedDevice ? `${title} (${selectedDevice})` : title;

const hasData = (series = []) => series.some((s) => Array.isArray(s.data) && s.data.length);

const BLUE_SERIES_KEYS = ["405nm", "425nm", "450nm", "475nm", "515nm"];
const RED_SERIES_KEYS = ["550nm", "555nm", "600nm", "640nm", "690nm", "745nm", "NIR855"];
const BLUE_SELECTION_KEYS = new Set(BLUE_SERIES_KEYS.map((key) => key.toLowerCase()));
const RED_SELECTION_KEYS = new Set(RED_SERIES_KEYS.map((key) => key.toLowerCase()));
const BLUE_ALIAS_KEYS = new Set(["blue", "bluelight", "bluespectrum"]);
const RED_ALIAS_KEYS = new Set(["red", "redlight", "redspectrum"]);

const toSelectionKey = (label) =>
    String(label ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

export default function ReportCharts({
                                         tempByCid,
                                         rangeByCid,
                                         phByCid,
                                         ecTdsByCid,
                                         doByCid,
                                         selectedSensors = [],
                                         xDomain,
                                         selectedDevice
                                     }) {
    const sensorEntries = useMemo(
        () =>
            (selectedSensors || []).map((label) => ({
                label,
                key: toSelectionKey(label),
            })),
        [selectedSensors],
    );

    const selectedKeys = useMemo(() => new Set(sensorEntries.map((entry) => entry.key)), [sensorEntries]);

    const hasBlueSelection = useMemo(
        () => sensorEntries.some(({ key }) => BLUE_SELECTION_KEYS.has(key) || BLUE_ALIAS_KEYS.has(key)),
        [sensorEntries],
    );

    const hasRedSelection = useMemo(
        () => sensorEntries.some(({ key }) => RED_SELECTION_KEYS.has(key) || RED_ALIAS_KEYS.has(key)),
        [sensorEntries],
    );

    const hasLuxSelection = useMemo(
        () => selectedKeys.has("light") || selectedKeys.has("lux"),
        [selectedKeys],
    );

    const chartSections = [
        {
            id: "temperature",
            visible: selectedKeys.has("temperature"),
            title: withDevice("Temperature", selectedDevice),
            description: "Monitor canopy-level temperature swings and react before plants feel the stress.",
            series: toSeries(tempByCid, "temperature"),
            yLabel: "Temperature (°C)",
        },
        {
            id: "humidity",
            visible: selectedKeys.has("humidity"),
            title: withDevice("Humidity", selectedDevice),
            description: "Keep relative humidity within the ideal VPD range for faster growth.",
            series: toSeries(tempByCid, "humidity"),
            yLabel: "Humidity (%)",
        },
        {
            id: "blueSpectrum",
            visible: hasBlueSelection,
            title: withDevice("Blue Spectrum", selectedDevice),
            description: "Review short-wavelength intensity to understand structural development.",
            series: toSpectrumSeries(rangeByCid, BLUE_SERIES_KEYS),
            yLabel: "Intensity",
        },
        {
            id: "redSpectrum",
            visible: hasRedSelection,
            title: withDevice("Red Spectrum", selectedDevice),
            description: "Balance the bloom spectrum to drive flowering without wasting energy.",
            series: toSpectrumSeries(rangeByCid, RED_SERIES_KEYS),
            yLabel: "Intensity",
        },
        {
            id: "lux",
            visible: hasLuxSelection,
            title: withDevice("Lux", selectedDevice),
            description: "Watch overall light levels to tune daily light integral (DLI).",
            series: toSeries(rangeByCid, "lux"),
            yLabel: "Lux",
        },
        {
            id: "ph",
            visible: selectedKeys.has("ph"),
            title: withDevice("pH", selectedDevice),
            description: "Maintain nutrient uptake by holding pH within your target band.",
            series: toSeries(phByCid, "ph"),
            yLabel: "pH",
        },
        {
            id: "ec",
            visible: selectedKeys.has("dissolvedec") || selectedKeys.has("ec"),
            title: withDevice("Electrical Conductivity", selectedDevice),
            description: "Spot dilution or concentration trends before EC drifts too far.",
            series: toSeries(ecTdsByCid, "ec"),
            yLabel: "EC (mS/cm)",
        },
        {
            id: "tds",
            visible: selectedKeys.has("dissolvedtds") || selectedKeys.has("tds"),
            title: withDevice("Total Dissolved Solids", selectedDevice),
            description: "Confirm nutrient dosing by tracking dissolved solids over time.",
            series: toSeries(ecTdsByCid, "tds"),
            yLabel: "TDS (ppm)",
        },
        {
            id: "do",
            visible: selectedKeys.has("dissolvedoxygen") || selectedKeys.has("do"),
            title: withDevice("Dissolved Oxygen", selectedDevice),
            description: "Protect root health with enough oxygenation in the solution.",
            series: toSeries(doByCid, "do"),
            yLabel: "Dissolved Oxygen (mg/L)",
        },
    ].filter((section) => section.visible);

    return (
        <div className={styles.reportsContent}>
            {chartSections.length > 0 ? (
                <div className={styles.metricsGrid}>
                    {chartSections.map(({ id, title, description, series, yLabel }) => (
                        <article key={id} className={styles.metricCard}>
                            <header className={styles.metricCardHeader}>
                                <div>
                                    <h3 className={styles.metricTitle}>{title}</h3>
                                    <p className={styles.metricSubtitle}>{description}</p>
                                </div>
                            </header>
                            <div className={styles.metricChart}>
                                {hasData(series) ? (
                                    <HistoryChart xDataKey="time" series={series} yLabel={yLabel} xDomain={xDomain} />
                                ) : (
                                    <div className={styles.metricEmpty}>No data available for the selected range.</div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <h3>No metrics selected</h3>
                    <p>Select at least one sensor in the filters to explore its performance over time.</p>
                </div>
            )}
        </div>
    );
}
