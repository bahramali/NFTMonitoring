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

const AIR_KEYS = new Set(["temperature", "humidity"]);
const WATER_KEYS = new Set(["ph", "dissolvedec", "dissolvedtds", "dissolvedoxygen", "dissolvedtemp"]);
const LIGHT_KEYS = new Set(["light", "lux", "vis1", "vis2", "nir855"]);
const BLUE_KEYS = new Set(["405nm", "425nm", "450nm", "475nm", "515nm"]);
const RED_KEYS = new Set(["550nm", "555nm", "600nm", "640nm", "690nm", "745nm"]);


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
                key: String(label || "").trim().toLowerCase(),
            })),
        [selectedSensors],
    );

    const selectedKeys = useMemo(() => new Set(sensorEntries.map((entry) => entry.key)), [sensorEntries]);

    const categorized = useMemo(() => {
        const buckets = {
            air: [],
            water: [],
            light: [],
            blue: [],
            red: [],
            other: [],
        };
        sensorEntries.forEach((entry) => {
            if (BLUE_KEYS.has(entry.key)) {
                buckets.blue.push(entry.label);
            } else if (RED_KEYS.has(entry.key)) {
                buckets.red.push(entry.label);
            } else if (WATER_KEYS.has(entry.key)) {
                buckets.water.push(entry.label);
            } else if (AIR_KEYS.has(entry.key)) {
                buckets.air.push(entry.label);
            } else if (LIGHT_KEYS.has(entry.key)) {
                buckets.light.push(entry.label);
            } else {
                buckets.other.push(entry.label);
            }
        });
        return buckets;
    }, [sensorEntries]);

    const deviceLabel = selectedDevice || "Multiple devices";

    const timelineLabel = useMemo(() => {
        if (!Array.isArray(xDomain) || xDomain.length !== 2) {
            return "Latest data window";
        }
        const [start, end] = xDomain;
        if (!start || !end) return "Latest data window";
        const fmt = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        return `${fmt.format(new Date(start))} — ${fmt.format(new Date(end))}`;
    }, [xDomain]);

    const sensorSummary = useMemo(() => {
        const entries = [
            { key: "air", label: "Air", value: categorized.air },
            { key: "water", label: "Water", value: categorized.water },
            { key: "light", label: "Light", value: categorized.light },
            { key: "blue", label: "Blue Spectrum", value: categorized.blue },
            { key: "red", label: "Red Spectrum", value: categorized.red },
            { key: "other", label: "Other", value: categorized.other },
        ];
        return entries
            .map((entry) => ({ ...entry, count: entry.value.length }))
            .filter((entry) => entry.count > 0);
    }, [categorized]);

    const totalSensorsSelected = sensorEntries.length;

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
            visible: categorized.blue.length > 0,
            title: withDevice("Blue Spectrum", selectedDevice),
            description: "Review short-wavelength intensity to understand structural development.",
            series: toSpectrumSeries(rangeByCid, categorized.blue),
            yLabel: "Intensity",
        },
        {
            id: "redSpectrum",
            visible: categorized.red.length > 0,
            title: withDevice("Red Spectrum", selectedDevice),
            description: "Balance the bloom spectrum to drive flowering without wasting energy.",
            series: toSpectrumSeries(rangeByCid, categorized.red),
            yLabel: "Intensity",
        },
        {
            id: "lux",
            visible: categorized.light.some((label) => label.toLowerCase() === "light"),
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
            visible: selectedKeys.has("dissolvedec"),
            title: withDevice("Electrical Conductivity", selectedDevice),
            description: "Spot dilution or concentration trends before EC drifts too far.",
            series: toSeries(ecTdsByCid, "ec"),
            yLabel: "EC (mS/cm)",
        },
        {
            id: "tds",
            visible: selectedKeys.has("dissolvedtds"),
            title: withDevice("Total Dissolved Solids", selectedDevice),
            description: "Confirm nutrient dosing by tracking dissolved solids over time.",
            series: toSeries(ecTdsByCid, "tds"),
            yLabel: "TDS (ppm)",
        },
        {
            id: "do",
            visible: selectedKeys.has("dissolvedoxygen"),
            title: withDevice("Dissolved Oxygen", selectedDevice),
            description: "Protect root health with enough oxygenation in the solution.",
            series: toSeries(doByCid, "do"),
            yLabel: "Dissolved Oxygen (mg/L)",
        },
    ].filter((section) => section.visible);

    const metricsDisplayed = chartSections.length;

    return (
        <div className={styles.reportsContent}>
            <section className={styles.hero}>
                <div className={styles.heroCopy}>
                    <span className={styles.eyebrow}>Sensor insights</span>
                    <h2 className={styles.heroTitle}>Time-series performance overview</h2>
                    <p className={styles.heroSubtitle}>
                        Visualize how each metric behaves across the selected timeframe to keep your grow stable.
                    </p>
                </div>
                <div className={styles.heroMeta}>
                    <div className={styles.metaCard}>
                        <span className={styles.metaLabel}>Device</span>
                        <span className={styles.metaValue}>{deviceLabel}</span>
                    </div>
                    <div className={styles.metaCard}>
                        <span className={styles.metaLabel}>Time range</span>
                        <span className={styles.metaValue}>{timelineLabel}</span>
                    </div>
                    <div className={styles.metaCard}>
                        <span className={styles.metaLabel}>Metrics shown</span>
                        <span className={styles.metaValue}>{metricsDisplayed}</span>
                    </div>
                </div>
            </section>

            {sensorSummary.length > 0 && (
                <div className={styles.sensorChips}>
                    {sensorSummary.map((entry) => (
                        <span key={entry.key} className={styles.sensorChip}>
                            {entry.label} · {entry.count}
                        </span>
                    ))}
                    <span className={styles.sensorChipMuted}>Total sensors · {totalSensorsSelected}</span>
                </div>
            )}

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
