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

export default function HallRackPage() {
    const navigate = useNavigate();
    const { rackId } = useParams();
    const normalizedRackId = String(rackId ?? "").trim().toUpperCase();

    const { inventory, cacheEntries } = useHallInventory();
    const rackInfo = inventory.racks.get(normalizedRackId);

    const layers = useMemo(() => {
        if (!rackInfo) return [];
        return Array.from(rackInfo.layers)
            .map((layer) => layer || "No layer")
            .sort((a, b) => a.localeCompare(b));
    }, [rackInfo, cacheEntries]);

    const devices = useMemo(() => {
        return cacheEntries
            .map((entry) => {
                const identity = entry?.identity;
                if (!identity) return null;
                const unitType = String(identity.unitType || "").trim().toUpperCase();
                const unitId = String(identity.unitId || "").trim().toUpperCase();
                if (unitType !== "RACK" || unitId !== normalizedRackId) return null;
                const sensors = resolveSensors(entry.message);
                const metrics = normalizeSensors(sensors);
                return {
                    deviceId: identity.deviceId,
                    layerId: identity.layerId ?? null,
                    lastUpdate: entry.timestamp,
                    metrics,
                };
            })
            .filter(Boolean);
    }, [cacheEntries, normalizedRackId]);

    const devicesWithMetrics = devices.filter((device) => Object.keys(device.metrics || {}).length > 0);

    return (
        <div className={styles.page}>
            <Header title={`Hall Rack ${normalizedRackId || ""}`.trim()} />

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
                    <span>Rack {normalizedRackId || "—"}</span>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Layers</div>
                </div>
                {layers.length === 0 ? (
                    <div className={styles.emptyState}>No layers discovered for this rack yet.</div>
                ) : (
                    <div className={styles.layerChips}>
                        {layers.map((layerId) => (
                            <button
                                key={layerId}
                                type="button"
                                className={styles.chipButton}
                                onClick={() => navigate(`/monitoring/hall/racks/${normalizedRackId}/layers/${layerId === "No layer" ? "no-layer" : layerId}`)}
                            >
                                {layerId}
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>Latest metrics</div>
                </div>

                {devicesWithMetrics.length === 0 ? (
                    <div className={styles.emptyState}>No metrics yet.</div>
                ) : (
                    <div className={styles.cardGrid}>
                        {devicesWithMetrics.map((device) => (
                            <article key={device.deviceId} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardTitle}>{device.deviceId}</div>
                                    <div className={styles.subtleText}>{formatTimestamp(device.lastUpdate)}</div>
                                </div>
                                <div className={styles.metricList}>
                                    {Object.entries(device.metrics)
                                        .slice(0, 6)
                                        .map(([key, value]) => (
                                            <div key={key} className={styles.metricRow}>
                                                <span className={styles.metricKey}>{key}</span>
                                                <span>{formatMetricValue(value) ?? "—"}</span>
                                            </div>
                                        ))}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
