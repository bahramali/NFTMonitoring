import React from "react";
import HistoryChart from "../../../components/HistoryChart.jsx";
import styles from "../Germination.module.css";

export default function HistoricalTrendsPanel({
    deviceOptions,
    selectedCompositeId,
    onCompositeChange,
    availableMetrics,
    selectedMetricKey,
    onMetricChange,
    emptyStateLabel,
    rangePreset,
    rangeOptions,
    onRangePreset,
    customFrom,
    customTo,
    onCustomFrom,
    onCustomTo,
    onRefresh,
    chartError,
    chartLoading,
    chartSeries,
    chartYLabel,
    chartDomain,
}) {
    return (
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
                                onChange={(event) => onCompositeChange(event.target.value)}
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
                                onChange={(event) => onMetricChange(event.target.value)}
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
                            {rangeOptions.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    className={`${styles.rangeButton} ${
                                        rangePreset === option.key ? styles.rangeButtonActive : ""
                                    }`}
                                    onClick={() => onRangePreset(option.key)}
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
                                    onChange={(event) => onCustomFrom(event.target.value)}
                                    className={styles.timeInput}
                                    max={customTo || undefined}
                                />
                            </label>
                            <label className={styles.chartLabel}>
                                To
                                <input
                                    type="datetime-local"
                                    value={customTo}
                                    onChange={(event) => onCustomTo(event.target.value)}
                                    className={styles.timeInput}
                                    min={customFrom || undefined}
                                />
                            </label>
                        </div>
                    )}
                    <button type="button" className={styles.refreshButton} onClick={onRefresh}>
                        Refresh
                    </button>
                </div>
            ) : (
                <div className={styles.emptyState}>
                    {emptyStateLabel
                        ? `No sensor nodes available for ${emptyStateLabel} rack.`
                        : "No sensor nodes available for this rack."}
                </div>
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
    );
}
