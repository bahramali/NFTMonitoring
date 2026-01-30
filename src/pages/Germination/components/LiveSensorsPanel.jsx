import React from "react";
import styles from "../Germination.module.css";
import { formatRangeValue } from "../germinationUtils.js";

export default function LiveSensorsPanel({ metricReports }) {
    return (
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
                                        const statusTone =
                                            value.status === "ERROR"
                                                ? styles.statusError
                                                : value.status === "STALE"
                                                ? styles.statusStale
                                                : styles.statusOk;
                                        return (
                                            <li
                                                key={value.id}
                                                className={styles.reportValueItem}
                                                title={value.debugId || undefined}
                                            >
                                                <span className={`${styles.reportDot} ${toneClass}`} />
                                                <div className={styles.reportDeviceMeta}>
                                                    <span className={styles.reportDevice}>{value.title}</span>
                                                    {value.subtitle ? (
                                                        <span className={styles.reportDeviceSub}>{value.subtitle}</span>
                                                    ) : null}
                                                </div>
                                                <span className={`${styles.statusBadge} ${statusTone}`}>
                                                    {value.status}
                                                </span>
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
    );
}
