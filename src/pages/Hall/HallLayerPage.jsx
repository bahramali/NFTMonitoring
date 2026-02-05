import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../common/Header";
import { normalizeSensors } from "../Overview/utils/index.js";
import { useHallInventory } from "./useHallInventory.js";
import styles from "./Hall.module.css";

const formatTimestamp = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
};

const formatMetricValue = (metric) => {
    const numeric = Number(metric?.value ?? metric);
    if (!Number.isFinite(numeric)) return null;
    const abs = Math.abs(numeric);
    const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 1 : 2;
    const unit = metric?.unit ? ` ${metric.unit}` : "";
    return `${numeric.toFixed(decimals)}${unit}`;
};

const resolveSensors = (message) => {
    if (!message) return null;
    if (message.sensors) return message.sensors;
    if (message.sensorData) return message.sensorData;
    if (message.data?.sensors) return message.data.sensors;
    if (message.payload?.sensors) return message.payload.sensors;
    return null;
};

export default function HallLayerPage() {
    const navigate = useNavigate();
    const { rackId, layerId } = useParams();
    const normalizedRackId = String(rackId ?? "").trim().toUpperCase();
    const normalizedLayerId = String(layerId ?? "").trim().toUpperCase();
    const isNoLayerRoute = normalizedLayerId === "NO-LAYER";

    const { cacheEntries } = useHallInventory();

    const groupedDevices = useMemo(() => {
        const groups = { C: [], T: [], R: [] };
        cacheEntries.forEach((entry) => {
            const identity = entry?.identity;
            if (!identity) return;
            const unitType = String(identity.unitType || "").trim().toUpperCase();
            const unitId = String(identity.unitId || "").trim().toUpperCase();
            const layerValue = String(identity.layerId || "").trim().toUpperCase();
            if (unitType !== "RACK" || unitId !== normalizedRackId) return;
            if (isNoLayerRoute) {
                if (layerValue) return;
            } else if (layerValue !== normalizedLayerId) {
                return;
            }

            const metrics = normalizeSensors(resolveSensors(entry.message));
            const deviceKind = identity.deviceId ? identity.deviceId.charAt(0).toUpperCase() : "D";
            groups[deviceKind] = groups[deviceKind] || [];
            groups[deviceKind].push({
                deviceId: identity.deviceId,
                deviceKind,
                lastUpdate: entry.timestamp,
                metrics,
            });
        });
        return groups;
    }, [cacheEntries, isNoLayerRoute, normalizedRackId, normalizedLayerId]);

    const groupEntries = Object.entries(groupedDevices).filter(([, list]) => list.length > 0);

    return (
        <div className={styles.page}>
            <Header title={`Hall Rack ${normalizedRackId} ${isNoLayerRoute ? "No layer" : normalizedLayerId}`.trim()} />

            <section className={styles.section}>
                <div className={styles.breadcrumbs}>
                    <button
                        type="button"
                        className={styles.breadcrumbLink}
                        onClick={() => navigate("/monitoring/hall")}
                    >
                        Hall
                    </button>
                    <span>/</span>
                    <button
                        type="button"
                        className={styles.breadcrumbLink}
                        onClick={() => navigate(`/monitoring/hall/racks/${normalizedRackId}`)}
                    >
                        Rack {normalizedRackId || "—"}
                    </button>
                    <span>/</span>
                    <span>Layer {isNoLayerRoute ? "No layer" : normalizedLayerId || "—"}</span>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Devices</div>
                </div>

                {groupEntries.length === 0 ? (
                    <div className={styles.emptyState}>No devices discovered for this layer yet.</div>
                ) : (
                    <div className={styles.deviceGroup}>
                        {groupEntries.map(([kind, devices]) => (
                            <div key={kind} className={styles.deviceGroup}>
                                <div className={styles.cardTitle}>
                                    {kind} Devices ({devices.length})
                                </div>
                                <div className={styles.cardGrid}>
                                    {devices.map((device) => (
                                        <article key={device.deviceId} className={styles.deviceCard}>
                                            <div className={styles.cardHeader}>
                                                <div className={styles.cardTitle}>{device.deviceId}</div>
                                                <div className={styles.subtleText}>
                                                    {formatTimestamp(device.lastUpdate)}
                                                </div>
                                            </div>
                                            {Object.keys(device.metrics || {}).length === 0 ? (
                                                <div className={styles.emptyState}>No metrics yet.</div>
                                            ) : (
                                                <div className={styles.metricList}>
                                                    {Object.entries(device.metrics).map(([key, value]) => (
                                                        <div key={key} className={styles.metricRow}>
                                                            <span className={styles.metricKey}>{key}</span>
                                                            <span>{formatMetricValue(value) ?? "—"}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
